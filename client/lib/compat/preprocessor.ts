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

import { getDisplayRegexScripts, applyRegexScripts } from "./regex-engine";
import { stripXmlTags } from "./xml-tag-stripper";

export function preprocessContent(
  content: string,
  extensions?: Record<string, unknown> | null,
): string {
  if (!content) return content;

  let result = content;

  // 1. Execute character-scoped regex scripts (AI_OUTPUT placement)
  const scripts = getDisplayRegexScripts(extensions);
  if (scripts.length > 0) {
    result = applyRegexScripts(result, scripts, "ai_output");
  }

  // 2. Strip remaining custom XML tags
  result = stripXmlTags(result);

  return result;
}
