import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { VectorStoreService } from './vector-store.service';
import { RagEmbedderService, type EmbedJobMessage } from './rag-embedder.service';
import { SettingsService } from '../settings/settings.service';
import type { RetrievedMemory, RagSettings } from './types';
import { DEFAULT_RAG_SETTINGS } from './types';

const KNOWN_DIMENSIONS = [1536, 768, 1024, 3072];

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly vectorStore: VectorStoreService,
    private readonly embedder: RagEmbedderService,
    private readonly settingsService: SettingsService,
  ) {}

  async getSettings(): Promise<RagSettings> {
    const raw = await this.settingsService.get('rag_settings');
    if (!raw) return { ...DEFAULT_RAG_SETTINGS };
    try {
      return { ...DEFAULT_RAG_SETTINGS, ...(typeof raw === 'string' ? JSON.parse(raw) : raw) };
    } catch {
      return { ...DEFAULT_RAG_SETTINGS };
    }
  }

  async saveSettings(settings: Partial<RagSettings>): Promise<RagSettings> {
    const current = await this.getSettings();
    const merged = { ...current, ...settings };
    await this.settingsService.set('rag_settings', JSON.stringify(merged));
    return merged;
  }

  onMessagePersisted(message: EmbedJobMessage, characterId: number, settings: RagSettings): void {
    if (!settings.enabled) return;
    if (message.role !== 'user' && message.role !== 'assistant') return;
    this.embedder.enqueue(message, characterId, settings);
  }

  async retrieveMemories(
    recentMessages: Array<{ content: string }>,
    characterId: number,
    chatId: number,
    settings: RagSettings,
  ): Promise<RetrievedMemory[]> {
    if (!settings.enabled) return [];

    try {
      const queryText = recentMessages
        .slice(-5)
        .map((m) => m.content)
        .join('\n')
        .slice(0, 2000);

      if (!queryText.trim()) return [];

      const provider = settings.embeddingProvider || 'openai';
      const model = settings.embeddingModel || '';

      const embeddingResponse = await this.aiProvider.embed({
        provider,
        model,
        input: [queryText],
        reverseProxy: settings.embeddingReverseProxy || undefined,
      });

      const queryVector = embeddingResponse.embeddings[0];
      const dimensions = embeddingResponse.dimensions;

      const filter = settings.scope === 'chat'
        ? `chatId = ${chatId}`
        : `characterId = ${characterId}`;

      const hasTable = await this.vectorStore.tableExists(dimensions);
      if (!hasTable) return [];

      const results = await this.vectorStore.search(
        queryVector,
        dimensions,
        filter,
        settings.maxResults * 2,
      );

      // Cosine distance: 0 = identical, 2 = opposite. Convert to similarity.
      const memories: RetrievedMemory[] = results
        .map((r) => ({
          content: r.content,
          role: r.role,
          name: r.name,
          score: 1 - (r._distance ?? 1),
          messageId: r.messageId,
          chatId: r.chatId,
          createdAt: r.createdAt,
        }))
        .filter((m) => m.score >= settings.minScore)
        .slice(0, settings.maxResults);

      // Deduplicate: keep highest scoring chunk per message
      const seen = new Map<number, RetrievedMemory>();
      for (const mem of memories) {
        const existing = seen.get(mem.messageId);
        if (!existing || mem.score > existing.score) {
          seen.set(mem.messageId, mem);
        }
      }

      return Array.from(seen.values()).sort((a, b) => b.score - a.score);
    } catch (err) {
      this.logger.warn('RAG retrieval failed, proceeding without memories', err);
      return [];
    }
  }

  async deleteMessageVectors(messageId: number): Promise<void> {
    for (const dims of KNOWN_DIMENSIONS) {
      try {
        if (await this.vectorStore.tableExists(dims)) {
          await this.vectorStore.deleteByMessageId(messageId, dims);
        }
      } catch { /* table may not exist */ }
    }
  }

  async deleteChatVectors(chatId: number): Promise<void> {
    for (const dims of KNOWN_DIMENSIONS) {
      try {
        if (await this.vectorStore.tableExists(dims)) {
          await this.vectorStore.deleteByChatId(chatId, dims);
        }
      } catch { /* ignore */ }
    }
  }

  async deleteCharacterVectors(characterId: number): Promise<void> {
    for (const dims of KNOWN_DIMENSIONS) {
      try {
        if (await this.vectorStore.tableExists(dims)) {
          await this.vectorStore.deleteByCharacterId(characterId, dims);
        }
      } catch { /* ignore */ }
    }
  }
}
