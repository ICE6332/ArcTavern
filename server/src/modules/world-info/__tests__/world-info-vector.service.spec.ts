/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import {
  WorldInfoVectorService,
  DEFAULT_WI_EMBEDDING_SETTINGS,
} from '../world-info-vector.service';
import type { WorldInfoEntryRow } from '../world-info.service';
import type { VectorStoreService } from '../../rag/vector-store.service';
import type { AiProviderService } from '../../ai-provider/ai-provider.service';
import type { SettingsService } from '../../settings/settings.service';
import type { WorldInfoService } from '../world-info.service';

function makeRow(overrides: Partial<WorldInfoEntryRow> = {}): WorldInfoEntryRow {
  return {
    id: 1,
    book_id: 1,
    uid: 1,
    keys: '[]',
    secondary_keys: '[]',
    content: 'hello world',
    comment: '',
    enabled: 1,
    insertion_order: 100,
    case_sensitive: 0,
    priority: 10,
    position: 'before_char',
    extensions: '{}',
    constant: 0,
    selective: 0,
    select_logic: 0,
    order: 100,
    exclude_recursion: 0,
    prevent_recursion: 0,
    probability: 100,
    use_probability: 1,
    depth: 4,
    group_name: '',
    group_override: 0,
    group_weight: 100,
    scan_depth: 0,
    match_whole_words: 0,
    use_group_scoring: 0,
    automation_id: '',
    role: 0,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    triggers: '[]',
    vectorized: 1,
    ignore_budget: 0,
    match_persona_desc: 0,
    match_char_desc: 0,
    match_char_personality: 0,
    match_scenario: 0,
    delay_until_recursion: 0,
    character_filter: '{}',
    content_hash: '',
    ...overrides,
  };
}

describe('WorldInfoVectorService', () => {
  it('contentSha256 is stable for same input', () => {
    const v = new WorldInfoVectorService(
      {} as VectorStoreService,
      {} as AiProviderService,
      {} as SettingsService,
      {} as WorldInfoService,
    );
    expect(v.contentSha256('abc')).toBe(v.contentSha256('abc'));
    expect(v.contentSha256('abc')).not.toBe(v.contentSha256('abcd'));
  });

  it('chunkText splits with overlap', () => {
    const v = new WorldInfoVectorService(
      {} as VectorStoreService,
      {} as AiProviderService,
      {} as SettingsService,
      {} as WorldInfoService,
    );
    const chunks = v.chunkText('a'.repeat(25), 10, 2);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('embedEntry skips when content hash unchanged', async () => {
    const embed = vi.fn();
    const v = new WorldInfoVectorService(
      {} as VectorStoreService,
      { embed } as unknown as AiProviderService,
      {} as SettingsService,
      { updateEntry: vi.fn() } as unknown as WorldInfoService,
    );
    const hash = v.contentSha256('same content');
    const entry = makeRow({ content: 'same content', content_hash: hash });
    const out = await v.embedEntry(entry, DEFAULT_WI_EMBEDDING_SETTINGS);
    expect(out.skipped).toBe(true);
    expect(embed).not.toHaveBeenCalled();
  });

  it('searchEntries dedupes by entryId keeping best score', async () => {
    const queryResult = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      distanceType: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([
        { entryId: 1, _distance: 0.1 },
        { entryId: 1, _distance: 0.05 },
        { entryId: 2, _distance: 0.2 },
      ]),
    };
    const mockTable = {
      search: vi.fn().mockReturnValue(queryResult),
    };
    const mockDb = {
      tableNames: vi.fn().mockResolvedValue(['worldinfo_1536d']),
      openTable: vi.fn().mockResolvedValue(mockTable),
    };
    const vectorStore = {
      getConnection: () => mockDb,
    } as unknown as VectorStoreService;

    const embed = vi.fn().mockResolvedValue({
      embeddings: [Array.from({ length: 1536 }, () => 0)],
      dimensions: 1536,
      model: 'm',
    });

    const svc = new WorldInfoVectorService(
      vectorStore,
      { embed } as unknown as AiProviderService,
      {} as SettingsService,
      {} as WorldInfoService,
    );

    const hits = await svc.searchEntries(
      'query',
      [1],
      { ...DEFAULT_WI_EMBEDDING_SETTINGS, minScore: 0.5 },
      10,
    );
    expect(hits).toHaveLength(2);
    const h1 = hits.find((h) => h.entryId === 1);
    expect(h1?.score).toBeCloseTo(0.95, 2);
  });

  it('deleteEntryVectors deletes from all worldinfo_* tables', async () => {
    const deletes: string[] = [];
    const mockTable = {
      delete: vi.fn((f: string) => {
        deletes.push(f);
        return Promise.resolve();
      }),
    };
    const mockDb = {
      tableNames: vi
        .fn()
        .mockResolvedValue(['worldinfo_1536d', 'memories_1536d', 'worldinfo_768d']),
      openTable: vi.fn().mockResolvedValue(mockTable),
    };
    const vectorStore = {
      getConnection: () => mockDb,
    } as unknown as VectorStoreService;

    const svc = new WorldInfoVectorService(
      vectorStore,
      {} as AiProviderService,
      {} as SettingsService,
      {} as WorldInfoService,
    );
    await svc.deleteEntryVectors(42);
    expect(mockDb.openTable).toHaveBeenCalledTimes(2);
    expect(deletes.every((d) => d.includes('42'))).toBe(true);
  });
});
