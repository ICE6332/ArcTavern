/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { WorldInfoScannerService, SelectLogic } from '../world-info-scanner.service';
import type { WorldInfoEntryRow } from '../world-info.service';
import {
  DEFAULT_WI_EMBEDDING_SETTINGS,
  type WorldInfoVectorService,
} from '../world-info-vector.service';

function makeEntry(overrides: Partial<WorldInfoEntryRow> = {}): WorldInfoEntryRow {
  return {
    id: 1,
    book_id: 1,
    uid: 1,
    keys: '["dragon"]',
    secondary_keys: '[]',
    content: 'A mighty dragon.',
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
    vectorized: 0,
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

describe('WorldInfoScannerService', () => {
  const scanner = new WorldInfoScannerService();

  it('activates entry when keyword matches', async () => {
    const entries = [makeEntry({ keys: '["dragon"]', content: 'Fire-breathing dragon.' })];
    const result = await scanner.scan(entries, { chatMessages: ['I saw a dragon today'] });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Fire-breathing dragon.');
  });

  it('does not activate when keyword is absent', async () => {
    const entries = [makeEntry({ keys: '["dragon"]' })];
    const result = await scanner.scan(entries, { chatMessages: ['I saw a cat today'] });

    expect(result).toHaveLength(0);
  });

  it('always activates constant entries', async () => {
    const entries = [makeEntry({ keys: '[]', constant: 1, content: 'Always here.' })];
    const result = await scanner.scan(entries, { chatMessages: ['anything'] });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Always here.');
  });

  it('handles selective AND_ANY logic', async () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.AND_ANY,
      }),
    ];

    const match = await scanner.scan(entries, { chatMessages: ['dragon breathes fire'] });
    expect(match).toHaveLength(1);

    const noMatch = await scanner.scan(entries, { chatMessages: ['dragon sleeps'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective NOT_ANY logic', async () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["evil"]',
        select_logic: SelectLogic.NOT_ANY,
      }),
    ];

    const match = await scanner.scan(entries, { chatMessages: ['a friendly dragon'] });
    expect(match).toHaveLength(1);

    const noMatch = await scanner.scan(entries, { chatMessages: ['an evil dragon'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective AND_ALL logic', async () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.AND_ALL,
      }),
    ];

    const match = await scanner.scan(entries, { chatMessages: ['dragon with fire and ice'] });
    expect(match).toHaveLength(1);

    const noMatch = await scanner.scan(entries, { chatMessages: ['dragon with fire only'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective NOT_ALL logic', async () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.NOT_ALL,
      }),
    ];

    // NOT_ALL: activates when NOT all secondary keys match
    const match = await scanner.scan(entries, { chatMessages: ['dragon with fire only'] });
    expect(match).toHaveLength(1);

    const noMatch = await scanner.scan(entries, { chatMessages: ['dragon with fire and ice'] });
    expect(noMatch).toHaveLength(0);
  });

  it('respects probability (0% never activates)', async () => {
    const entries = [makeEntry({ keys: '["test"]', probability: 0, use_probability: 1 })];
    const result = await scanner.scan(entries, { chatMessages: ['test message'] });

    expect(result).toHaveLength(0);
  });

  it('sorts results by insertion order', async () => {
    const entries = [
      makeEntry({ id: 1, keys: '["hello"]', insertion_order: 200, content: 'second' }),
      makeEntry({ id: 2, keys: '["hello"]', insertion_order: 50, content: 'first' }),
    ];
    const result = await scanner.scan(entries, { chatMessages: ['hello world'] });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('first');
    expect(result[1].content).toBe('second');
  });

  it('scans character description for keywords', async () => {
    const entries = [makeEntry({ keys: '["warrior"]' })];
    const result = await scanner.scan(entries, {
      chatMessages: ['hello'],
      characterDescription: 'A brave warrior',
    });

    expect(result).toHaveLength(1);
  });

  it('handles disabled entries', async () => {
    const entries = [makeEntry({ keys: '["test"]', enabled: 0 })];
    const result = await scanner.scan(entries, { chatMessages: ['test'] });

    expect(result).toHaveLength(0);
  });

  it('activates vectorized entries via semantic search when keywords do not match', async () => {
    const searchEntries = vi.fn().mockResolvedValue([{ entryId: 7, score: 0.95 }]);
    const vectorService = { searchEntries } as unknown as WorldInfoVectorService;
    const entries = [
      makeEntry({
        id: 7,
        vectorized: 1,
        keys: '[]',
        content: 'Deep lore',
      }),
    ];
    const result = await scanner.scan(
      entries,
      { chatMessages: ['unrelated chat'] },
      {},
      vectorService,
      { ...DEFAULT_WI_EMBEDDING_SETTINGS, hybridMode: false },
    );
    expect(searchEntries).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(7);
  });

  it('hybrid mode still keyword-matches vectorized entries', async () => {
    const searchEntries = vi.fn().mockResolvedValue([]);
    const vectorService = { searchEntries } as unknown as WorldInfoVectorService;
    const entries = [
      makeEntry({
        id: 2,
        vectorized: 1,
        keys: '["dragon"]',
        content: 'Dragon lore',
      }),
    ];
    const result = await scanner.scan(
      entries,
      { chatMessages: ['a dragon appears'] },
      {},
      vectorService,
      { ...DEFAULT_WI_EMBEDDING_SETTINGS, hybridMode: true },
    );
    expect(result).toHaveLength(1);
  });

  it('falls back to keyword matching when vector search throws', async () => {
    const searchEntries = vi.fn().mockRejectedValue(new Error('embed failed'));
    const vectorService = { searchEntries } as unknown as WorldInfoVectorService;
    const entries = [makeEntry({ keys: '["alpha"]', vectorized: 1 })];
    const result = await scanner.scan(
      entries,
      { chatMessages: ['alpha beta'] },
      {},
      vectorService,
      DEFAULT_WI_EMBEDDING_SETTINGS,
    );
    expect(result).toHaveLength(1);
  });
});
