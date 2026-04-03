/**
 * Generates the JavaScript bootstrap script injected into compat iframes.
 *
 * The bootstrap establishes:
 *  - `window.ArcTavern` as a Proxy that auto-routes any method call to an RPC.
 *  - `window.eventOn()` / `window.eventEmit()` for pub-sub.
 *  - `window.$()` for dynamic HTML loading.
 *  - Auto-resize via ResizeObserver.
 *
 * Using a Proxy means new RPC handlers registered on the host are automatically
 * callable from iframes without changing this script.
 */

export function buildBridgeBootstrap(widgetId: string): string {
  return `<script>
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

  window.ArcTavern = new Proxy({
    requestUiRefresh: function () { __notifyResize(); }
  }, {
    get: function (target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop in target) return target[prop];
      return function (params) {
        return __rpc(prop, typeof params === "object" && params !== null ? params : {});
      };
    }
  });

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

export function injectBootstrap(html: string, widgetId: string): string {
  const bootstrap = buildBridgeBootstrap(widgetId);

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${bootstrap}</head>`);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${bootstrap}`);
  }

  return `<!DOCTYPE html><html><head>${bootstrap}</head><body>${html}</body></html>`;
}
