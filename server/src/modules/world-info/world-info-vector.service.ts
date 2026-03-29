import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Table } from '@lancedb/lancedb';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { SettingsService } from '../settings/settings.service';
import { VectorStoreService } from '../rag/vector-store.service';
import type { WorldInfoEntryRow } from './world-info.service';
import { WorldInfoService } from './world-info.service';

export const WI_EMBEDDING_SETTINGS_KEY = 'wi_embedding_settings';

export interface WIEmbeddingSettings {
  provider: string;
  model: string;
  reverseProxy?: string;
  chunkSize: number;
  chunkOverlap: number;
  minScore: number;
  hybridMode: boolean;
}

export const DEFAULT_WI_EMBEDDING_SETTINGS: WIEmbeddingSettings = {
  /** Matches `LocalEmbeddingService` / `AiProviderService.embed` when provider is `local`. */
  provider: 'local',
  model: 'jina-embeddings-v2-base-zh',
  chunkSize: 1000,
  chunkOverlap: 200,
  minScore: 0.3,
  hybridMode: true,
};

type LanceRecord = Record<string, unknown>;

export interface WorldInfoVectorSearchHit {
  entryId: number;
  score: number;
}

export interface EmbedEntryResult {
  contentHash: string;
  dimensions: number;
  skipped?: boolean;
}

@Injectable()
export class WorldInfoVectorService {
  private readonly logger = new Logger(WorldInfoVectorService.name);

  constructor(
    private readonly vectorStore: VectorStoreService,
    private readonly aiProvider: AiProviderService,
    private readonly settingsService: SettingsService,
    private readonly worldInfoService: WorldInfoService,
  ) {}

  async getSettings(): Promise<WIEmbeddingSettings> {
    const raw = await this.settingsService.get(WI_EMBEDDING_SETTINGS_KEY);
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_WI_EMBEDDING_SETTINGS };
    }
    return { ...DEFAULT_WI_EMBEDDING_SETTINGS, ...(raw as Partial<WIEmbeddingSettings>) };
  }

  async saveSettings(data: Partial<WIEmbeddingSettings>): Promise<WIEmbeddingSettings> {
    const merged = { ...(await this.getSettings()), ...data };
    await this.settingsService.set(WI_EMBEDDING_SETTINGS_KEY, merged);
    return merged;
  }

  /** Open or create LanceDB table `worldinfo_{dimensions}d`. */
  async getTable(dimensions: number): Promise<Table> {
    const db = this.vectorStore.getConnection();
    const name = this.worldInfoTableName(dimensions);
    const tableNames = await db.tableNames();
    if (tableNames.includes(name)) {
      return db.openTable(name);
    }
    const seed: LanceRecord = {
      id: '__seed__',
      entryId: -1,
      bookId: -1,
      content: '',
      vector: Array.from({ length: dimensions }, () => 0),
      createdAt: new Date().toISOString(),
      chunkIndex: 0,
    };
    const table = await db.createTable(name, [seed]);
    await table.delete("id = '__seed__'");
    return table;
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

  contentSha256(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  async embedEntry(
    entry: WorldInfoEntryRow,
    settings: WIEmbeddingSettings,
  ): Promise<EmbedEntryResult> {
    const content = entry.content ?? '';
    const hash = this.contentSha256(content);
    const existing = (entry.content_hash ?? '').trim();
    if (existing === hash) {
      return { contentHash: hash, dimensions: 0, skipped: true };
    }

    await this.deleteEntryVectors(entry.id);

    const chunks = this.chunkText(content, settings.chunkSize, settings.chunkOverlap);
    if (chunks.length === 0) {
      // Content is empty or whitespace-only — persist the hash to mark it as processed,
      // but skip embedding since there's nothing to vectorize.
      await this.worldInfoService.updateEntry(entry.id, { contentHash: hash });
      return { contentHash: hash, dimensions: 0 };
    }

    const response = await this.aiProvider.embed({
      provider: settings.provider,
      model: settings.model,
      input: chunks,
      reverseProxy: settings.reverseProxy,
    });

    const dimensions = response.dimensions;
    const table = await this.getTable(dimensions);
    const createdAt = new Date().toISOString();
    const records: LanceRecord[] = chunks.map((chunk, i) => ({
      id: `wi_${entry.id}_${i}`,
      entryId: entry.id,
      bookId: entry.book_id,
      content: chunk,
      vector: response.embeddings[i],
      createdAt,
      chunkIndex: i,
    }));

    await table.add(records);
    await this.worldInfoService.updateEntry(entry.id, { contentHash: hash });
    return { contentHash: hash, dimensions };
  }

  async embedBook(bookId: number, settings: WIEmbeddingSettings): Promise<number> {
    const entries = await this.worldInfoService.findEntries(bookId);
    const targets = entries.filter((e) => e.vectorized);
    let embedded = 0;
    for (const entry of targets) {
      try {
        const result = await this.embedEntry(entry, settings);
        if (!result.skipped) embedded += 1;
      } catch (err) {
        this.logger.warn(`embedEntry failed for entry ${entry.id}`, err);
      }
    }
    return embedded;
  }

  async searchEntries(
    queryText: string,
    bookIds: number[],
    settings: WIEmbeddingSettings,
    limit: number,
  ): Promise<WorldInfoVectorSearchHit[]> {
    const trimmed = queryText.trim().slice(0, 4000);
    if (!trimmed || bookIds.length === 0) return [];

    const response = await this.aiProvider.embed({
      provider: settings.provider,
      model: settings.model,
      input: [trimmed],
      reverseProxy: settings.reverseProxy,
    });

    const dimensions = response.dimensions;
    const queryVector = response.embeddings[0];
    const db = this.vectorStore.getConnection();
    const name = this.worldInfoTableName(dimensions);
    const tableNames = await db.tableNames();
    if (!tableNames.includes(name)) return [];

    const table = await db.openTable(name);
    const filter = `bookId IN (${bookIds.join(',')})`;
    const query = table
      .search(queryVector)
      .where(filter)
      .limit(Math.max(limit * 4, 32));
    if (
      'distanceType' in query &&
      typeof (query as { distanceType?: (d: string) => void }).distanceType === 'function'
    ) {
      (query as { distanceType: (d: string) => void }).distanceType('cosine');
    }
    const rows = (await query.toArray()) as Array<{
      entryId: number;
      _distance: number;
    }>;

    const byEntry = new Map<number, number>();
    for (const row of rows) {
      const score = 1 - (row._distance ?? 1);
      if (score < settings.minScore) continue;
      const prev = byEntry.get(row.entryId);
      if (prev === undefined || score > prev) {
        byEntry.set(row.entryId, score);
      }
    }

    const hits: WorldInfoVectorSearchHit[] = Array.from(byEntry.entries())
      .map(([entryId, score]) => ({ entryId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return hits;
  }

  async deleteEntryVectors(entryId: number): Promise<void> {
    const db = this.vectorStore.getConnection();
    const names = await db.tableNames();
    for (const name of names) {
      if (!/^worldinfo_\d+d$/.test(name)) continue;
      const table = await db.openTable(name);
      await table.delete(`entryId = ${entryId}`);
    }
  }

  async deleteBookVectors(bookId: number): Promise<void> {
    const db = this.vectorStore.getConnection();
    const names = await db.tableNames();
    for (const name of names) {
      if (!/^worldinfo_\d+d$/.test(name)) continue;
      const table = await db.openTable(name);
      await table.delete(`bookId = ${bookId}`);
    }
  }

  private worldInfoTableName(dimensions: number): string {
    return `worldinfo_${dimensions}d`;
  }
}
