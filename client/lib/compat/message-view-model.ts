import type { PreparedAssistantDisplay } from "@/lib/compat/display-pipeline";

type MessageRole = "user" | "assistant" | "system" | "tool";

export interface PreparedMessageViewModel extends PreparedAssistantDisplay {
  reasoningDisplay?: string;
  hasWidgets: boolean;
}

interface PrepareMessageViewModelParams {
  role: MessageRole;
  content: string;
  reasoning?: string;
  formatAssistantForDisplay: (content: string) => PreparedAssistantDisplay;
  preprocess: (content: string, role: string) => string;
}

const emptyAssistantDisplay: PreparedAssistantDisplay = {
  display: "",
  scripts: [],
  thinking: "",
  segments: [],
  compatData: {},
};

export function prepareMessageViewModel({
  role,
  content,
  reasoning,
  formatAssistantForDisplay,
  preprocess,
}: PrepareMessageViewModelParams): PreparedMessageViewModel {
  const prepared =
    role === "assistant"
      ? formatAssistantForDisplay(content)
      : {
          ...emptyAssistantDisplay,
          display: preprocess(content, role),
        };

  const combinedReasoning = [reasoning, prepared.thinking].filter(Boolean).join("\n\n") || undefined;
  const reasoningDisplay =
    combinedReasoning && role === "assistant"
      ? formatAssistantForDisplay(combinedReasoning).display
      : combinedReasoning;

  return {
    ...prepared,
    reasoningDisplay,
    hasWidgets: prepared.segments.some((segment) => segment.type === "widget"),
  };
}
