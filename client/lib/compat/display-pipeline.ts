/**
 * Assistant message display pipeline: runs after regex + XML preprocessing.
 * Strips <script> blocks from rendered markdown/HTML while collecting them for js-runtime.
 * Extracts preset-level <think>/<thinking> blocks for separate CoT rendering.
 */

import { partitionScripts } from "@/lib/compat/js-runtime/extractor";
import { extractThinking } from "@/lib/compat/thinking-extractor";

export interface PreparedAssistantDisplay {
  display: string;
  scripts: string[];
  thinking: string;
}

export function prepareAssistantDisplay(preprocessed: string): PreparedAssistantDisplay {
  if (!preprocessed) return { display: "", scripts: [], thinking: "" };

  const { thinking, cleaned } = extractThinking(preprocessed);
  const { display, scripts } = partitionScripts(cleaned);

  return { display, scripts, thinking };
}
