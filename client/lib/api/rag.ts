import { request } from "./core/http";

export interface RagSettings {
  enabled: boolean;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingReverseProxy: string;
  scope: "chat" | "character";
  maxResults: number;
  minScore: number;
  maxTokenBudget: number;
  chunkSize: number;
  chunkOverlap: number;
  insertionPosition: "before_char" | "after_char" | "at_depth";
  insertionDepth: number;
}

export const ragApi = {
  getSettings: () => request<RagSettings>("/rag/settings"),
  updateSettings: (data: Partial<RagSettings>) =>
    request<RagSettings>("/rag/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteChatVectors: (chatId: number) =>
    request<{ deleted: boolean }>(`/rag/chat/${chatId}/vectors`, {
      method: "DELETE",
    }),
  deleteMessageVectors: (messageId: number) =>
    request<{ deleted: boolean }>(`/rag/message/${messageId}/vectors`, {
      method: "DELETE",
    }),
  deleteCharacterVectors: (characterId: number) =>
    request<{ deleted: boolean }>(`/rag/character/${characterId}/vectors`, {
      method: "DELETE",
    }),
};
