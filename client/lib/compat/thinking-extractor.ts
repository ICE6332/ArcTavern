/**
 * Extract preset-level thinking/CoT content from message text.
 *
 * Many presets instruct models to wrap reasoning inside `<think>` or
 * `<thinking>` tags within the normal content output.  This module
 * extracts that text so it can be rendered separately via the
 * ChainOfThought UI component, while removing it from the main display.
 *
 * Soft-isolated: only consumed through the display pipeline.
 */

const THINKING_TAG_RE = /<(think|thinking)(?:\s[^>]*)?>(?<inner>[\s\S]*?)<\/\1>/gi;

export interface ThinkingExtraction {
  /** Concatenated thinking content (empty string when none found). */
  thinking: string;
  /** Content with thinking blocks removed. */
  cleaned: string;
}

export function extractThinking(content: string): ThinkingExtraction {
  if (!content) return { thinking: "", cleaned: content };

  const parts: string[] = [];

  const cleaned = content.replace(THINKING_TAG_RE, (_match, _tag, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed) parts.push(trimmed);
    return "";
  });

  return {
    thinking: parts.join("\n\n"),
    cleaned: cleaned.replace(/\n{3,}/g, "\n\n").trim(),
  };
}
