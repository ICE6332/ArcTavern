export type Provider = "openai" | "anthropic" | "google" | "openrouter" | "mistral" | "custom";

export type GenerationType =
  | "normal"
  | "regenerate"
  | "swipe"
  | "continue"
  | "impersonate"
  | "quiet";

export interface CompletionRequest {
  provider: Provider;
  model: string;
  messages: {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  tools?: unknown[];
  toolChoice?: "auto" | "none" | "required" | { type: string; function: { name: string } };
  assistantPrefill?: string;
  jsonSchema?: { name: string; description?: string; value: object };
  reasoningEffort?: string;
  reverseProxy?: string;
  customApiFormat?: "openai-compatible" | "google" | "openai" | "anthropic";
}
