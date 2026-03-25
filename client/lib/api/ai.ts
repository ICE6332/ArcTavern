import { getApiBase, request } from "./core/http";
import { readSSE } from "./core/stream";
import type { CompletionRequest, Provider } from "./types";

export interface LocalModelStatus {
  downloaded: boolean;
  loading: boolean;
  modelId: string;
}

export const aiApi = {
  async complete(data: CompletionRequest) {
    return request<{ content: string; model: string; finishReason: string }>("/ai/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async tokenize(data: { text?: string; messages?: CompletionRequest["messages"] }) {
    return request<{ tokens: number; method: string }>("/ai/tokenize", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async models(provider?: Provider) {
    const suffix = provider ? `?provider=${provider}` : "";
    return request<unknown>(`/ai/models${suffix}`);
  },
  async *streamChat(data: CompletionRequest, signal?: AbortSignal) {
    for await (const chunk of readSSE(
      `${getApiBase()}/ai/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, stream: true }),
      },
      signal,
    )) {
      yield chunk;
    }
  },
  async healthCheck(req: { provider: string; apiKey?: string; baseUrl: string }) {
    return request<{
      status: "ok" | "error";
      message: string;
      latency?: number;
      models?: Array<{ id: string; contextWindow?: number }>;
    }>("/ai-provider/health-check", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async discoverModels(provider: string, baseUrl: string) {
    return request<Array<{ id: string; contextWindow?: number }>>(
      `/ai-provider/models/discover?provider=${encodeURIComponent(provider)}&baseUrl=${encodeURIComponent(baseUrl)}`,
    );
  },
  async testRequest(req: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    body: Record<string, unknown>;
  }) {
    return request<unknown>("/ai-provider/test-request", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};

export const localEmbeddingApi = {
  getStatus: () => request<LocalModelStatus>("/embedding/local/status"),
  download: () =>
    request<{ success: boolean }>("/embedding/local/download", {
      method: "POST",
    }),
};
