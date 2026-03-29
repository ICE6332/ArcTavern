/**
 * Extract executable <script> bodies from HTML-like message text.
 *
 * - Classic scripts (no type, or type text/javascript / application/javascript) are
 *   extracted for the compat sandbox and removed from display HTML.
 * - `type="module"` is NOT executed (no ES module loader in sandbox); the block is
 *   stripped from display only.
 * - Other script types are stripped and not executed.
 */

const SCRIPT_BLOCK = /<script(?=[\s>])([^>]*)>([\s\S]*?)<\/script>/gi;

function parseTypeAttr(attrs: string): string | null {
  const m = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "").trim().toLowerCase();
}

function shouldExtractForSandbox(type: string | null): boolean {
  if (type === null || type === "") return true;
  if (type === "module") return false;
  return type === "text/javascript" || type === "application/javascript";
}

/**
 * Split display text and script bodies (single pass).
 */
export function partitionScripts(html: string): { display: string; scripts: string[] } {
  if (!html) return { display: "", scripts: [] };

  const scripts: string[] = [];
  const display = html.replace(SCRIPT_BLOCK, (_full, attrs: string, body: string) => {
    const type = parseTypeAttr(attrs ?? "");
    if (!shouldExtractForSandbox(type)) {
      return "";
    }
    scripts.push(body);
    return "";
  });

  return { display, scripts };
}

export function extractScripts(html: string): string[] {
  return partitionScripts(html).scripts;
}

export function stripScripts(html: string): string {
  return partitionScripts(html).display;
}
