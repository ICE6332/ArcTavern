"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chatApi } from "@/lib/api/chat";
import { ST_COMPAT_VARS_KEY } from "@/lib/compat/js-runtime";
import type { CompatBridgeData } from "@/lib/compat/widget-pipeline";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useVariableStore } from "@/stores/variable-store";

interface CompatHtmlWidgetProps {
  messageId?: number;
  swipeId: number;
  html: string;
  compatData: CompatBridgeData;
  onRunSlashCommand?: (command: string) => Promise<void> | void;
}

type WidgetHostRpcRequest = {
  __arcWidget: true;
  widgetId: string;
  type: "rpc";
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type WidgetHostEventRequest = {
  __arcWidget: true;
  widgetId: string;
  type: "emit";
  event: string;
  detail?: unknown;
};

type WidgetHostReadyRequest = {
  __arcWidget: true;
  widgetId: string;
  type: "ready";
};

type WidgetHostResizeRequest = {
  __arcWidget: true;
  widgetId: string;
  type: "resize";
  height?: number;
};

type WidgetIncomingMessage =
  | WidgetHostRpcRequest
  | WidgetHostEventRequest
  | WidgetHostReadyRequest
  | WidgetHostResizeRequest;

function getCompatVarRow(messageId: number | undefined, swipeId: number): Record<string, unknown> {
  if (!messageId) return {};

  const message = useChatStore.getState().messages.find((item) => item.id === messageId);
  const raw = message?.extra?.[ST_COMPAT_VARS_KEY];
  if (!Array.isArray(raw)) return {};

  const row = raw[swipeId];
  return row && typeof row === "object" ? { ...(row as Record<string, unknown>) } : {};
}

function buildBridgeBootstrap(widgetId: string): string {
  return `
<script>
(function () {
  var __widgetId = ${JSON.stringify(widgetId)};
  var __listeners = new Map();
  var __pending = new Map();
  var __counter = 0;

  function __notifyResize() {
    var height = 240;
    try {
      var body = document.body;
      var docEl = document.documentElement;
      height = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        docEl ? docEl.scrollHeight : 0,
        docEl ? docEl.offsetHeight : 0,
        240
      );
    } catch (error) {}

    parent.postMessage(
      { __arcWidget: true, widgetId: __widgetId, type: "resize", height: height },
      "*"
    );
  }

  function __dispatch(eventName, detail) {
    var handlers = __listeners.get(eventName);
    if (!handlers) return;
    handlers.forEach(function (handler) {
      try {
        handler(detail);
      } catch (error) {
        console.error("[compat-widget] listener error", error);
      }
    });
  }

  function __rpc(method, params) {
    return new Promise(function (resolve, reject) {
      var id = "__arc_widget_rpc_" + (++__counter);
      __pending.set(id, { resolve: resolve, reject: reject });
      parent.postMessage(
        { __arcWidget: true, widgetId: __widgetId, type: "rpc", id: id, method: method, params: params || {} },
        "*"
      );
    });
  }

  async function __loadIntoTarget(target, url) {
    var response = await fetch(url);
    var html = await response.text();
    var parser = new DOMParser();
    var parsed = parser.parseFromString(html, "text/html");

    Array.from(parsed.head.querySelectorAll("style, link[rel='stylesheet']")).forEach(function (node) {
      document.head.appendChild(node.cloneNode(true));
    });

    if (target) {
      target.innerHTML = parsed.body ? parsed.body.innerHTML : html;
    }

    var scriptNodes = Array.from(parsed.querySelectorAll("script"));
    for (var i = 0; i < scriptNodes.length; i += 1) {
      var source = scriptNodes[i];
      var script = document.createElement("script");
      Array.from(source.attributes).forEach(function (attr) {
        script.setAttribute(attr.name, attr.value);
      });
      script.textContent = source.textContent;
      document.body.appendChild(script);
    }

    __notifyResize();
  }

  window.eventOn = function (eventName, handler) {
    if (!__listeners.has(eventName)) {
      __listeners.set(eventName, new Set());
    }
    __listeners.get(eventName).add(handler);
    return function () {
      var handlers = __listeners.get(eventName);
      if (handlers) handlers.delete(handler);
    };
  };

  window.eventEmit = function (eventName, detail) {
    parent.postMessage(
      { __arcWidget: true, widgetId: __widgetId, type: "emit", event: eventName, detail: detail },
      "*"
    );
  };

  window.ArcTavern = {
    getContext: function () { return __rpc("getContext"); },
    getVariable: function (name, scope) { return __rpc("getVariable", { name: name, scope: scope || "auto" }); },
    setVariable: function (name, value, scope) { return __rpc("setVariable", { name: name, value: value, scope: scope || "compat" }); },
    runSlashCommand: function (command) { return __rpc("runSlashCommand", { command: command }); },
    requestWriteDone: function () { return __rpc("requestWriteDone"); },
    requestUiRefresh: function () { __notifyResize(); }
  };

  window.$ = function (selector) {
    var target = typeof selector === "string" ? document.querySelector(selector) : selector;
    return {
      load: function (url) {
        return __loadIntoTarget(target, url);
      }
    };
  };

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.__arcWidget !== true || data.widgetId !== __widgetId) return;

    if (data.type === "dispatch") {
      __dispatch(data.event, data.detail);
      return;
    }

    if (data.type === "rpcResult") {
      var pending = __pending.get(data.id);
      if (!pending) return;
      __pending.delete(data.id);
      if (data.error) {
        pending.reject(new Error(data.error));
      } else {
        pending.resolve(data.result);
      }
    }
  });

  window.addEventListener("load", __notifyResize);
  document.addEventListener("DOMContentLoaded", __notifyResize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(__notifyResize).observe(document.documentElement);
  }

  parent.postMessage({ __arcWidget: true, widgetId: __widgetId, type: "ready" }, "*");
})();
</script>`;
}

function injectBootstrap(html: string, widgetId: string): string {
  const bootstrap = buildBridgeBootstrap(widgetId);

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${bootstrap}</head>`);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${bootstrap}`);
  }

  return `<!DOCTYPE html><html><head>${bootstrap}</head><body>${html}</body></html>`;
}

export function CompatHtmlWidget({
  messageId,
  swipeId,
  html,
  compatData,
  onRunSlashCommand,
}: CompatHtmlWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetIdRef = useRef(`arc-widget-${crypto.randomUUID()}`);
  const [height, setHeight] = useState(280);

  const srcDoc = useMemo(() => injectBootstrap(html, widgetIdRef.current), [html]);

  useEffect(() => {
    async function updateCompatVariable(name: string, value: unknown) {
      if (!messageId) return;

      const message = useChatStore.getState().messages.find((item) => item.id === messageId);
      if (!message) return;

      const extra = { ...message.extra };
      const raw = extra[ST_COMPAT_VARS_KEY];
      const rows = Array.isArray(raw) ? [...raw] : [];
      while (rows.length <= swipeId) {
        rows.push({});
      }

      const row =
        rows[swipeId] && typeof rows[swipeId] === "object"
          ? { ...(rows[swipeId] as Record<string, unknown>) }
          : {};

      row[name] = value;
      rows[swipeId] = row;
      extra[ST_COMPAT_VARS_KEY] = rows;

      const updated = await chatApi.updateMessage(messageId, { extra });
      useChatStore.setState((state) => ({
        messages: state.messages.map((item) => (item.id === messageId ? updated : item)),
      }));
    }

    function postToWidget(message: Record<string, unknown>) {
      iframeRef.current?.contentWindow?.postMessage(
        {
          __arcWidget: true,
          widgetId: widgetIdRef.current,
          ...message,
        },
        "*",
      );
    }

    function buildContext() {
      const variableStore = useVariableStore.getState();
      const characterStore = useCharacterStore.getState();
      const characterId = characterStore.selectedId;
      const character = characterStore.characters.find((item) => item.id === characterId);
      const messages = useChatStore
        .getState()
        .messages.map((item) => ({ id: item.id, role: item.role, content: item.content }));

      return {
        compatData,
        globalVariables: variableStore.globalVariables,
        chatVariables: variableStore.chatVariables,
        compatVariables: getCompatVarRow(messageId, swipeId),
        character: {
          id: character?.id ?? null,
          name: character?.name ?? "",
          avatar: character?.avatar ?? "",
        },
        message: {
          id: messageId ?? null,
          swipeId,
          extra:
            useChatStore.getState().messages.find((item) => item.id === messageId)?.extra ?? {},
        },
        messages,
      };
    }

    async function handleRpc(method: string, params: Record<string, unknown> = {}) {
      const variableStore = useVariableStore.getState();
      const compatRow = getCompatVarRow(messageId, swipeId);
      const name = typeof params.name === "string" ? params.name : "";
      const scope = typeof params.scope === "string" ? params.scope : "auto";

      switch (method) {
        case "getContext":
          return buildContext();
        case "requestWriteDone":
          return { statWithoutMeta: compatData.statWithoutMeta };
        case "getVariable":
          if (!name) return undefined;
          if (scope === "compat") return compatRow[name];
          if (scope === "chat") return variableStore.chatVariables[name];
          if (scope === "global") return variableStore.globalVariables[name];
          return (
            compatRow[name] ??
            variableStore.chatVariables[name] ??
            variableStore.globalVariables[name]
          );
        case "setVariable": {
          if (!name) return false;
          const value = params.value;
          if (scope === "global") {
            variableStore.setGlobalVariable(name, String(value ?? ""));
            return true;
          }
          if (scope === "chat") {
            variableStore.setChatVariable(name, String(value ?? ""));
            return true;
          }
          await updateCompatVariable(name, value);
          return true;
        }
        case "runSlashCommand": {
          const command = typeof params.command === "string" ? params.command : "";
          if (!command || !onRunSlashCommand) return false;
          await onRunSlashCommand(command);
          return true;
        }
        default:
          return undefined;
      }
    }

    async function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data as WidgetIncomingMessage | null;
      if (!data || data.__arcWidget !== true || data.widgetId !== widgetIdRef.current) return;

      if (data.type === "resize") {
        setHeight(Math.max(Number(data.height ?? 0), 240));
        return;
      }

      if (data.type === "ready") {
        postToWidget({
          type: "dispatch",
          event: "arctavern:context",
          detail: buildContext(),
        });
        return;
      }

      if (data.type === "emit") {
        if (data.event === "era:requestWriteDone") {
          postToWidget({
            type: "dispatch",
            event: "era:writeDone",
            detail: { statWithoutMeta: compatData.statWithoutMeta },
          });
        } else if (data.event === "arctavern:requestContext") {
          postToWidget({
            type: "dispatch",
            event: "arctavern:context",
            detail: buildContext(),
          });
        } else if (
          data.event === "slash:run" &&
          data.detail &&
          typeof data.detail === "object" &&
          "command" in data.detail &&
          typeof data.detail.command === "string" &&
          onRunSlashCommand
        ) {
          await onRunSlashCommand(data.detail.command);
        }
        return;
      }

      if (data.type === "rpc") {
        try {
          const result = await handleRpc(data.method, data.params);
          postToWidget({
            type: "rpcResult",
            id: data.id,
            result,
          });
        } catch (error) {
          postToWidget({
            type: "rpcResult",
            id: data.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [compatData, messageId, onRunSlashCommand, swipeId]);

  return (
    <iframe
      ref={iframeRef}
      title="Compat HTML Widget"
      sandbox="allow-forms allow-modals allow-popups allow-scripts"
      className="w-full rounded-md border border-border/60 bg-background"
      style={{ height }}
      srcDoc={srcDoc}
    />
  );
}
