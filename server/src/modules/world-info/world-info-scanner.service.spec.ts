/// <reference types="vitest/globals" />
import { WorldInfoScannerService, SelectLogic } from './world-info-scanner.service';
import type { WorldInfoEntryRow } from './world-info.service';

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
    ...overrides,
  };
}

describe('WorldInfoScannerService', () => {
  const scanner = new WorldInfoScannerService();

  it('activates entry when keyword matches', () => {
    const entries = [makeEntry({ keys: '["dragon"]', content: 'Fire-breathing dragon.' })];
    const result = scanner.scan(entries, { chatMessages: ['I saw a dragon today'] });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Fire-breathing dragon.');
  });

  it('does not activate when keyword is absent', () => {
    const entries = [makeEntry({ keys: '["dragon"]' })];
    const result = scanner.scan(entries, { chatMessages: ['I saw a cat today'] });

    expect(result).toHaveLength(0);
  });

  it('always activates constant entries', () => {
    const entries = [makeEntry({ keys: '[]', constant: 1, content: 'Always here.' })];
    const result = scanner.scan(entries, { chatMessages: ['anything'] });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Always here.');
  });

  it('handles selective AND_ANY logic', () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.AND_ANY,
      }),
    ];

    const match = scanner.scan(entries, { chatMessages: ['dragon breathes fire'] });
    expect(match).toHaveLength(1);

    const noMatch = scanner.scan(entries, { chatMessages: ['dragon sleeps'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective NOT_ANY logic', () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["evil"]',
        select_logic: SelectLogic.NOT_ANY,
      }),
    ];

    const match = scanner.scan(entries, { chatMessages: ['a friendly dragon'] });
    expect(match).toHaveLength(1);

    const noMatch = scanner.scan(entries, { chatMessages: ['an evil dragon'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective AND_ALL logic', () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.AND_ALL,
      }),
    ];

    const match = scanner.scan(entries, { chatMessages: ['dragon with fire and ice'] });
    expect(match).toHaveLength(1);

    const noMatch = scanner.scan(entries, { chatMessages: ['dragon with fire only'] });
    expect(noMatch).toHaveLength(0);
  });

  it('handles selective NOT_ALL logic', () => {
    const entries = [
      makeEntry({
        keys: '["dragon"]',
        selective: 1,
        secondary_keys: '["fire", "ice"]',
        select_logic: SelectLogic.NOT_ALL,
      }),
    ];

    // NOT_ALL: activates when NOT all secondary keys match
    const match = scanner.scan(entries, { chatMessages: ['dragon with fire only'] });
    expect(match).toHaveLength(1);

    const noMatch = scanner.scan(entries, { chatMessages: ['dragon with fire and ice'] });
    expect(noMatch).toHaveLength(0);
  });

  it('respects probability (0% never activates)', () => {
    const entries = [makeEntry({ keys: '["test"]', probability: 0, use_probability: 1 })];
    const result = scanner.scan(entries, { chatMessages: ['test message'] });

    expect(result).toHaveLength(0);
  });

  it('sorts results by insertion order', () => {
    const entries = [
      makeEntry({ id: 1, keys: '["hello"]', insertion_order: 200, content: 'second' }),
      makeEntry({ id: 2, keys: '["hello"]', insertion_order: 50, content: 'first' }),
    ];
    const result = scanner.scan(entries, { chatMessages: ['hello world'] });

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('first');
    expect(result[1].content).toBe('second');
  });

  it('scans character description for keywords', () => {
    const entries = [makeEntry({ keys: '["warrior"]' })];
    const result = scanner.scan(entries, {
      chatMessages: ['hello'],
      characterDescription: 'A brave warrior',
    });

    expect(result).toHaveLength(1);
  });

  it('handles disabled entries', () => {
    const entries = [makeEntry({ keys: '["test"]', enabled: 0 })];
    const result = scanner.scan(entries, { chatMessages: ['test'] });

    expect(result).toHaveLength(0);
  });
});
