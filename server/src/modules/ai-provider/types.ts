export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
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

export interface ProviderAdapter {
  name: string;
  buildRequest(req: CompletionRequest, apiKey: string): {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  parseResponse(data: unknown): CompletionResponse;
  parseStreamChunk(chunk: string): string | null;
}
