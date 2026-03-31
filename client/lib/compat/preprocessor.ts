/**
 * Compat layer unified entry point.
 *
 * Orchestrates regex script execution and XML tag stripping
 * on message content before rendering. This is the only export
 * consumed by the bridge hook `use-content-preprocessor.ts`.
 *
 * Assistant HTML/script display is further split in `display-pipeline.ts`
 * (strip `<script>` for ReactMarkdown + optional js-runtime).
 */

import {
  getDisplayRegexScripts,
  getPlacementRegexScripts,
  applyRegexScripts,
} from "./regex-engine";
import type { RegexScriptData } from "./regex-engine";
import { extractAssistantRenderSegments } from "./widget-pipeline";
import { stripXmlTags } from "./xml-tag-stripper";

export function preprocessContent(
  content: string,
  extensions?: Record<string, unknown> | null,
  globalScripts?: RegexScriptData[],
): string {
  if (!content) return content;

  let result = content;

  // 1. Execute global + character-scoped regex scripts (AI_OUTPUT placement).
  // Character scripts run after global ones so per-character rules can override shared cleanup.
  const scripts = [
    ...getPlacementRegexScripts(globalScripts, "ai_output"),
    ...getDisplayRegexScripts(extensions),
  ];
  if (scripts.length > 0) {
    result = applyRegexScripts(result, scripts, "ai_output");
  }

  // 2. Protect full widget documents before XML stripping so their internal
  // html/head/style/script tags survive for the sandboxed widget renderer.
  const widgetSegments = extractAssistantRenderSegments(result);
  if (widgetSegments.some((segment) => segment.type === "widget")) {
    const widgetTokens = new Map<string, string>();
    const protectedContent = widgetSegments
      .map((segment, index) => {
        if (segment.type === "markdown") {
          return segment.content;
        }

        const token = `__ARC_WIDGET_TOKEN_${index}__`;
        widgetTokens.set(token, segment.html);
        return token;
      })
      .join("");

    result = stripXmlTags(protectedContent);

    for (const [token, html] of widgetTokens.entries()) {
      result = result.replace(token, html);
    }
  } else {
    // 3. Strip remaining custom XML tags
    result = stripXmlTags(result);
  }

  return result;
}
