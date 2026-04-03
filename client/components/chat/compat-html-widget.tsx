"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dispatchRpc, type RpcContext } from "@/lib/compat-sandbox/rpc-registry";
import { registerBuiltinHandlers } from "@/lib/compat-sandbox/rpc-handlers";
import { injectBootstrap } from "@/lib/compat-sandbox/bootstrap-generator";
import type { CompatBridgeData } from "@/lib/compat/widget-pipeline";

interface CompatHtmlWidgetProps {
  messageId?: number;
  swipeId: number;
  html: string;
  compatData: CompatBridgeData;
  onRunSlashCommand?: (command: string) => Promise<void> | void;
}

interface WidgetIncomingMessage {
  __arcWidget: true;
  widgetId: string;
  type: "rpc" | "emit" | "ready" | "resize";
  // rpc fields
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  // emit fields
  event?: string;
  detail?: unknown;
  // resize fields
  height?: number;
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
    registerBuiltinHandlers();

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

    function buildRpcContext(): RpcContext {
      return {
        chatId: null,
        characterId: null,
        messageId,
        swipeId,
        extras: { compatData },
      };
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
        try {
          const ctx = buildRpcContext();
          const context = await dispatchRpc("getContext", {}, ctx);
          postToWidget({
            type: "dispatch",
            event: "arctavern:context",
            detail: context,
          });
        } catch {
          /* ignore */
        }
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
          try {
            const ctx = buildRpcContext();
            const context = await dispatchRpc("getContext", {}, ctx);
            postToWidget({
              type: "dispatch",
              event: "arctavern:context",
              detail: context,
            });
          } catch {
            /* ignore */
          }
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

      if (data.type === "rpc" && data.id && data.method) {
        const ctx = buildRpcContext();
        try {
          const result = await dispatchRpc(data.method, data.params ?? {}, ctx);
          postToWidget({ type: "rpcResult", id: data.id, result });
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
