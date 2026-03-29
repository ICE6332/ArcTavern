/**
 * Assistant message display pipeline: runs after regex + XML preprocessing.
 * Strips <script> blocks from rendered markdown/HTML while collecting them for js-runtime.
 */

import { partitionScripts } from "@/lib/compat/js-runtime/extractor";

export function prepareAssistantDisplay(preprocessed: string): {
  display: string;
  scripts: string[];
} {
  if (!preprocessed) return { display: "", scripts: [] };
  return partitionScripts(preprocessed);
}
