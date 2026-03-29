/**
 * Soft-isolated script runner: hidden iframe + postMessage bridge.
 *
 * Security model: parent-created functions are NEVER injected into the iframe.
 * Instead, the iframe communicates via a structured postMessage protocol,
 * preventing prototype-chain escapes (e.g. `getVar.constructor("return window.parent")`).
 */

export class SandboxRuntime {
  private iframe: HTMLIFrameElement | null = null;
  private win: Window | null = null;
  private globals: Record<string, unknown> = {};
  private boundListener: ((e: MessageEvent) => void) | null = null;

  constructor() {
    if (typeof document === "undefined") return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("sandbox", "allow-scripts");
    document.body.appendChild(iframe);
    this.iframe = iframe;
    this.win = iframe.contentWindow;
    if (!this.win) {
      this.destroy();
      return;
    }

    this.boundListener = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundListener);
  }

  /**
   * Execute a script inside the sandbox with the given globals.
   * Functions in globals are callable from the iframe via postMessage bridge.
   */
  run(script: string, globals: Record<string, unknown>): void {
    if (!this.win) return;
    this.globals = globals;

    const fnNames = Object.keys(globals).filter((k) => typeof globals[k] === "function");
    const staticGlobals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(globals)) {
      if (typeof v !== "function") staticGlobals[k] = v;
    }

    const bridgeScript = buildBridgeScript(fnNames, staticGlobals, script);

    try {
      const w = this.win as unknown as { eval: (code: string) => unknown };
      w.eval(bridgeScript);
    } catch (err) {
      console.error("[compat] sandbox script error", err);
    }
  }

  destroy(): void {
    if (this.boundListener) {
      window.removeEventListener("message", this.boundListener);
      this.boundListener = null;
    }
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.win = null;
    this.globals = {};
  }

  private handleMessage(e: MessageEvent): void {
    if (e.source !== this.win) return;

    const data = e.data;
    if (!data || typeof data !== "object" || data.__sandbox !== true) return;

    if (data.type === "call") {
      const { id, fn, args } = data as {
        id: string;
        fn: string;
        args: unknown[];
      };
      const func = this.globals[fn];
      if (typeof func !== "function") {
        this.win?.postMessage(
          { __sandbox: true, type: "result", id, error: `Unknown function: ${fn}` },
          "*",
        );
        return;
      }
      try {
        const result = func(...(Array.isArray(args) ? args : []));
        if (result instanceof Promise) {
          result.then(
            (v: unknown) =>
              this.win?.postMessage({ __sandbox: true, type: "result", id, value: v }, "*"),
            (err: unknown) =>
              this.win?.postMessage(
                { __sandbox: true, type: "result", id, error: String(err) },
                "*",
              ),
          );
        } else {
          this.win?.postMessage({ __sandbox: true, type: "result", id, value: result }, "*");
        }
      } catch (err) {
        this.win?.postMessage({ __sandbox: true, type: "result", id, error: String(err) }, "*");
      }
    }
  }
}

/**
 * Build a self-contained script that runs inside the iframe.
 * It creates proxy stubs for each parent function that use postMessage,
 * injects static (serializable) globals, then executes the user script.
 */
function buildBridgeScript(
  fnNames: string[],
  staticGlobals: Record<string, unknown>,
  userScript: string,
): string {
  const stubs = fnNames
    .map(
      (name) => `
function ${name}() {
  var args = Array.prototype.slice.call(arguments);
  var id = '__sc_' + (++__callId);
  parent.postMessage({ __sandbox: true, type: 'call', id: id, fn: '${name}', args: args }, '*');
  // ST compat scripts are synchronous fire-and-forget; no return value needed.
}`,
    )
    .join("\n");

  const staticInjects = Object.entries(staticGlobals)
    .map(([k, v]) => `var ${k} = ${JSON.stringify(v)};`)
    .join("\n");

  return `(function(){
var __callId = 0;
${stubs}
${staticInjects}
${userScript}
})()`;
}
