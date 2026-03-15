/**
 * Detect the preset type from a parsed JSON object based on key signatures.
 * Detection order matters — more specific signatures first.
 */
export function detectPresetType(data: Record<string, unknown>): string | null {
  // OpenAI: chat-completion config or prompt manager structures
  if (
    "chat_completion_source" in data ||
    "prompts" in data ||
    "prompt_order" in data ||
    "openai_max_tokens" in data ||
    "openai_max_context" in data
  ) {
    return "openai";
  }

  // Instruct: has input_sequence + output_sequence
  if ("input_sequence" in data && "output_sequence" in data) return "instruct";

  // Context: has story_string (Handlebars template)
  if ("story_string" in data) return "context";

  // Sysprompt: has content + post_history and few keys
  if ("content" in data && "post_history" in data && Object.keys(data).length <= 5)
    return "sysprompt";

  // Reasoning: has prefix + suffix + separator
  if ("prefix" in data && "suffix" in data && "separator" in data) return "reasoning";

  // TextGen: has temperature_last or sampler_priority
  if ("temperature_last" in data || "sampler_priority" in data) return "textgen";

  // NovelAI: has phrase_rep_pen or repetition_penalty_frequency
  if ("phrase_rep_pen" in data || "repetition_penalty_frequency" in data) return "novel";

  // KoboldAI: has temp + rep_pen + sampler_order (broadest, last)
  if ("temp" in data && "rep_pen" in data && "sampler_order" in data) return "kobold";

  return null;
}
