/**
 * Soft-isolated script runner: hidden iframe + eval, inspired by ST-Prompt-Template
 * FunctionSandbox — no SillyTavern parent globals, no same-origin.
 */

export class SandboxRuntime {
  private iframe: HTMLIFrameElement | null = null;
  private win: Window | null = null;

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
    this.hardenEnvironment();
  }

  run(script: string, globals: Record<string, unknown>): void {
    if (!this.win) return;
    this.injectContext(globals);
    const wrapped = `(function(){\n${script}\n})()`;
    try {
      const w = this.win as unknown as { eval: (code: string) => unknown };
      w.eval(wrapped);
    } catch (err) {
      console.error("[compat] sandbox script error", err);
    }
  }

  destroy(): void {
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.win = null;
  }

  private injectContext(context: Record<string, unknown>): void {
    if (!this.win) return;
    const win = this.win as unknown as Record<string, unknown>;
    for (const key of Object.keys(context)) {
      win[key] = context[key];
    }
  }

  private hardenEnvironment(): void {
    if (!this.win) return;
    const win = this.win;

    const protect = (name: "parent" | "top" | "frameElement") => {
      try {
        Object.defineProperty(win, name, {
          get: () => null,
          set: () => {},
          configurable: false,
          enumerable: false,
        });
      } catch {
        /* ignore */
      }
    };

    protect("parent");
    protect("top");
    protect("frameElement");

    try {
      Object.defineProperty(win, "fetch", { value: undefined, configurable: true });
    } catch {
      /* ignore */
    }
    try {
      Object.defineProperty(win, "XMLHttpRequest", { value: undefined, configurable: true });
    } catch {
      /* ignore */
    }
  }
}
