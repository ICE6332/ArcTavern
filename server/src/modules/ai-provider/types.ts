export interface ContentPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface ToolDefinition {
  type?: string;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface ToolCall {
  id?: string;
  type?: string;
  function?: {
    name: string;
    arguments?: string;
  };
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface CompletionRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  tools?: ToolDefinition[];
  toolChoice?:
    | 'auto'
    | 'none'
    | 'required'
    | { type: string; function: { name: string } };
  assistantPrefill?: string;
  jsonSchema?: { name: string; description?: string; value: object };
  reasoningEffort?: string;
  safetySettings?: Array<Record<string, unknown>>;
  generationConfig?: Record<string, unknown>;
  maxContext?: number;
  userName?: string;
  reverseProxy?: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionStreamChunk {
  content?: string;
  reasoning?: string;
}

// --- Embedding types ---

export interface EmbeddingRequest {
  provider: string;
  model: string;
  input: string[];
  reverseProxy?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// --- Health check types ---

export interface HealthCheckRequest {
  provider: string;
  apiKey?: string;
  baseUrl: string;
}

export interface ModelInfo {
  id: string;
  contextWindow?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  message: string;
  latency?: number;
  models?: ModelInfo[];
}

export interface TestRequestPayload {
  provider: string;
  apiKey: string;
  baseUrl: string;
  body: Record<string, unknown>;
}

export interface ModelsApiResponse {
  data?: Array<{
    id?: string;
    model?: string;
    name?: string;
    context_length?: number;
    max_tokens?: number;
  }>;
  models?: Array<{
    id?: string;
    model?: string;
    name?: string;
    context_length?: number;
    max_tokens?: number;
  }>;
}
