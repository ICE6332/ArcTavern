export interface VectorRecord {
  id: string;
  messageId: number;
  chatId: number;
  characterId: number;
  role: string;
  name: string;
  content: string;
  vector: number[];
  createdAt: string;
  chunkIndex: number;
}

export interface RetrievedMemory {
  content: string;
  role: string;
  name: string;
  score: number;
  messageId: number;
  chatId: number;
  createdAt: string;
}

export interface RagSettings {
  enabled: boolean;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingReverseProxy: string;
  scope: 'chat' | 'character';
  maxResults: number;
  minScore: number;
  maxTokenBudget: number;
  chunkSize: number;
  chunkOverlap: number;
  insertionPosition: 'before_char' | 'after_char' | 'at_depth';
  insertionDepth: number;
}

export const DEFAULT_RAG_SETTINGS: RagSettings = {
  enabled: false,
  embeddingProvider: '',
  embeddingModel: '',
  embeddingReverseProxy: '',
  scope: 'character',
  maxResults: 10,
  minScore: 0.3,
  maxTokenBudget: 1024,
  chunkSize: 1000,
  chunkOverlap: 200,
  insertionPosition: 'after_char',
  insertionDepth: 4,
};
