import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { VectorStoreService } from './vector-store.service';
import type { VectorRecord, RagSettings } from './types';

export interface EmbedJobMessage {
  id: number;
  chat_id: number;
  role: string;
  name: string;
  content: string;
  created_at: string;
}

interface EmbedJob {
  message: EmbedJobMessage;
  characterId: number;
  settings: RagSettings;
}

@Injectable()
export class RagEmbedderService {
  private readonly logger = new Logger(RagEmbedderService.name);
  private queue: EmbedJob[] = [];
  private processing = false;

  constructor(
    private readonly aiProvider: AiProviderService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  enqueue(message: EmbedJobMessage, characterId: number, settings: RagSettings): void {
    this.queue.push({ message, characterId, settings });
    if (!this.processing) {
      this.processQueue().catch((err) => this.logger.error('Queue processing error', err));
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try {
        await this.embedMessage(job);
      } catch (err) {
        this.logger.warn(`Failed to embed message ${job.message.id}`, err);
      }
    }
    this.processing = false;
  }

  private async embedMessage(job: EmbedJob): Promise<void> {
    const { message, characterId, settings } = job;
    const chunks = this.chunkText(message.content, settings.chunkSize, settings.chunkOverlap);
    if (chunks.length === 0) return;

    const provider = settings.embeddingProvider || 'openai';
    const model = settings.embeddingModel || '';

    const response = await this.aiProvider.embed({
      provider,
      model,
      input: chunks,
      reverseProxy: settings.embeddingReverseProxy || undefined,
    });

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: `msg_${message.id}_${i}`,
      messageId: message.id,
      chatId: message.chat_id,
      characterId,
      role: message.role,
      name: message.name,
      content: chunk,
      vector: response.embeddings[i],
      createdAt: message.created_at,
      chunkIndex: i,
    }));

    await this.vectorStore.addRecords(records, response.dimensions);
    this.logger.debug(
      `Embedded message ${message.id} (${chunks.length} chunks, ${response.dimensions}d)`,
    );
  }

  chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= chunkSize) return [trimmed];

    const chunks: string[] = [];
    let start = 0;
    while (start < trimmed.length) {
      const end = Math.min(start + chunkSize, trimmed.length);
      chunks.push(trimmed.slice(start, end));
      if (end >= trimmed.length) break;
      start += chunkSize - overlap;
    }
    return chunks;
  }
}
