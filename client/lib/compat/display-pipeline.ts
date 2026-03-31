/**
 * Assistant message display pipeline: runs after regex + XML preprocessing.
 * Strips <script> blocks from rendered markdown/HTML while collecting them for js-runtime.
 * Extracts preset-level <think>/<thinking> blocks for separate CoT rendering.
 */

import { partitionScripts } from "@/lib/compat/js-runtime/extractor";
import { extractThinking } from "@/lib/compat/thinking-extractor";
import {
  extractAssistantRenderSegments,
  extractCompatBridgeData,
  type AssistantRenderSegment,
  type CompatBridgeData,
} from "@/lib/compat/widget-pipeline";

export interface PreparedAssistantDisplay {
  display: string;
  scripts: string[];
  thinking: string;
  segments: AssistantRenderSegment[];
  compatData: CompatBridgeData;
}

export function prepareAssistantDisplay(
  rawContent: string,
  preprocessed: string,
): PreparedAssistantDisplay {
  if (!preprocessed) {
    return {
      display: "",
      scripts: [],
      thinking: "",
      segments: [],
      compatData: extractCompatBridgeData(rawContent),
    };
  }

  const compatData = extractCompatBridgeData(rawContent);
  const { thinking, cleaned } = extractThinking(preprocessed);
  const rawSegments = extractAssistantRenderSegments(cleaned);
  const scripts: string[] = [];
  const segments = rawSegments.map((segment) => {
    if (segment.type === "widget") {
      return segment;
    }

    const partitioned = partitionScripts(segment.content);
    scripts.push(...partitioned.scripts);
    return {
      type: "markdown" as const,
      content: partitioned.display,
    };
  });

  const display = segments
    .filter(
      (segment): segment is Extract<AssistantRenderSegment, { type: "markdown" }> =>
        segment.type === "markdown",
    )
    .map((segment) => segment.content)
    .join("\n\n");

  return {
    display,
    scripts,
    thinking,
    segments,
    compatData,
  };
}
