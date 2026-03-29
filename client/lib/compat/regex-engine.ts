/**
 * SillyTavern regex script compatibility engine.
 *
 * Soft-isolated: this module lives in `lib/compat/` and is only consumed
 * through `preprocessor.ts`. Core code never imports from here directly.
 */

// ST placement enum values
const PLACEMENT_AI_OUTPUT = 2;
const PLACEMENT_USER_INPUT = 1;

export interface RegexScriptData {
  id?: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings?: string[];
  placement: number[];
  disabled?: boolean;
  markdownOnly?: boolean;
  promptOnly?: boolean;
  runOnEdit?: boolean;
  substituteRegex?: number;
  minDepth?: number | null;
  maxDepth?: number | null;
}

/**
 * Parse a regex string like `/pattern/flags` into a RegExp.
 * Falls back to `new RegExp(str)` if not in slash notation.
 */
export function regexFromString(input: string): RegExp | null {
  if (!input) return null;

  try {
    const match = input.match(/^\/(.+)\/([gimsuy]*)$/);
    if (match) {
      return new RegExp(match[1], match[2]);
    }
    return new RegExp(input);
  } catch {
    return null;
  }
}

/**
 * Execute a single regex script on a string.
 * Replicates ST's `runRegexScript()` core logic.
 */
export function runRegexScript(script: RegexScriptData, rawString: string): string {
  if (!script || script.disabled || !script.findRegex || !rawString) {
    return rawString;
  }

  const findRegex = regexFromString(script.findRegex);
  if (!findRegex) return rawString;

  // Reset lastIndex for global/sticky regexes
  if (findRegex.global || findRegex.sticky) {
    findRegex.lastIndex = 0;
  }

  const trimStrings = script.trimStrings ?? [];

  return rawString.replace(findRegex, (...args: unknown[]) => {
    // Replace {{match}} with $0 in the replace string
    let replaceString = (script.replaceString ?? "").replace(/\{\{match\}\}/gi, "$0");

    // Process capture group references ($1, $2, etc.) and named groups ($<name>)
    replaceString = replaceString.replace(
      /\$(\d+)|\$<([^>]+)>/g,
      (_, num?: string, groupName?: string) => {
        let matched: string | undefined;

        if (num !== undefined) {
          matched = args[Number(num)] as string | undefined;
        } else if (groupName) {
          const groups = args[args.length - 1];
          if (groups && typeof groups === "object") {
            matched = (groups as Record<string, string>)[groupName];
          }
        }

        if (!matched) return "";

        // Apply trim strings
        return filterString(matched, trimStrings);
      },
    );

    return replaceString;
  });
}

function filterString(raw: string, trimStrings: string[]): string {
  let result = raw;
  for (const trim of trimStrings) {
    if (trim) result = result.replaceAll(trim, "");
  }
  return result;
}

/**
 * Extract enabled AI_OUTPUT regex scripts from character extensions.
 */
export function getDisplayRegexScripts(
  extensions?: Record<string, unknown> | null,
): RegexScriptData[] {
  if (!extensions) return [];

  const scripts = extensions.regex_scripts;
  if (!Array.isArray(scripts)) return [];

  return scripts.filter((s: unknown): s is RegexScriptData => {
    if (!s || typeof s !== "object") return false;
    const script = s as RegexScriptData;
    return (
      !script.disabled &&
      typeof script.findRegex === "string" &&
      Array.isArray(script.placement) &&
      script.placement.includes(PLACEMENT_AI_OUTPUT)
    );
  });
}

/**
 * Apply all applicable regex scripts to content.
 */
export function applyRegexScripts(
  content: string,
  scripts: RegexScriptData[],
  placement: "ai_output" | "user_input",
): string {
  const placementValue = placement === "ai_output" ? PLACEMENT_AI_OUTPUT : PLACEMENT_USER_INPUT;
  let result = content;

  for (const script of scripts) {
    if (!script.placement.includes(placementValue)) continue;
    if (script.disabled) continue;

    try {
      result = runRegexScript(script, result);
    } catch (err) {
      console.warn(`[compat/regex] Script "${script.scriptName}" failed:`, err);
    }
  }

  return result;
}
