import { describe, it, expect } from 'vitest';
import { normalizeEntry, normalizeLorebook } from './world-info-normalizer';

describe('normalizeEntry', () => {
  it('maps ST internal field names (camelCase)', () => {
    const result = normalizeEntry({
      key: ['hello', 'world'],
      keysecondary: ['foo'],
      content: 'test content',
      comment: 'a comment',
      constant: true,
      selective: true,
      selectiveLogic: 2,
      order: 50,
      position: 4,
      disable: false,
      excludeRecursion: true,
      preventRecursion: false,
      probability: 80,
      useProbability: true,
      depth: 6,
      group: 'myGroup',
      groupOverride: true,
      groupWeight: 200,
      scanDepth: 10,
      caseSensitive: true,
      matchWholeWords: true,
      useGroupScoring: true,
      automationId: 'auto1',
      role: 1,
      sticky: 3,
      cooldown: 2,
      delay: 1,
      vectorized: true,
      ignoreBudget: true,
      matchPersonaDescription: true,
      matchCharacterDescription: true,
      matchCharacterPersonality: false,
      matchScenario: true,
      delayUntilRecursion: 2,
      characterFilter: { names: ['Alice'], isExclude: false },
    });

    expect(result.keys).toBe('["hello","world"]');
    expect(result.secondary_keys).toBe('["foo"]');
    expect(result.content).toBe('test content');
    expect(result.comment).toBe('a comment');
    expect(result.constant).toBe(1);
    expect(result.selective).toBe(1);
    expect(result.select_logic).toBe(2);
    expect(result.order).toBe(50);
    expect(result.position).toBe('at_depth');
    expect(result.enabled).toBe(1);
    expect(result.exclude_recursion).toBe(1);
    expect(result.prevent_recursion).toBe(0);
    expect(result.probability).toBe(80);
    expect(result.use_probability).toBe(1);
    expect(result.depth).toBe(6);
    expect(result.group_name).toBe('myGroup');
    expect(result.group_override).toBe(1);
    expect(result.group_weight).toBe(200);
    expect(result.scan_depth).toBe(10);
    expect(result.case_sensitive).toBe(1);
    expect(result.match_whole_words).toBe(1);
    expect(result.use_group_scoring).toBe(1);
    expect(result.automation_id).toBe('auto1');
    expect(result.role).toBe(1);
    expect(result.sticky).toBe(3);
    expect(result.cooldown).toBe(2);
    expect(result.delay).toBe(1);
    expect(result.vectorized).toBe(1);
    expect(result.ignore_budget).toBe(1);
    expect(result.match_persona_desc).toBe(1);
    expect(result.match_char_desc).toBe(1);
    expect(result.match_char_personality).toBe(0);
    expect(result.match_scenario).toBe(1);
    expect(result.delay_until_recursion).toBe(2);
    expect(JSON.parse(result.character_filter)).toEqual({ names: ['Alice'], isExclude: false });
  });

  it('maps TavernCard V2 character_book field names (snake_case)', () => {
    const result = normalizeEntry({
      keys: ['test'],
      secondary_keys: ['bar'],
      content: 'hello',
      enabled: true,
      insertion_order: 42,
      case_sensitive: 1,
      position: 'before_char',
      select_logic: 3,
      depth: 8,
    });

    expect(result.keys).toBe('["test"]');
    expect(result.secondary_keys).toBe('["bar"]');
    expect(result.enabled).toBe(1);
    expect(result.insertion_order).toBe(42);
    expect(result.case_sensitive).toBe(1);
    expect(result.position).toBe('before_char');
    expect(result.select_logic).toBe(3);
    expect(result.depth).toBe(8);
  });

  it('handles disable=true → enabled=0', () => {
    const result = normalizeEntry({ disable: true });
    expect(result.enabled).toBe(0);
  });

  it('handles comma-separated keys string', () => {
    const result = normalizeEntry({ key: 'hello, world, test' });
    expect(result.keys).toBe('["hello","world","test"]');
  });

  it('defaults all fields for empty input', () => {
    const result = normalizeEntry({});
    expect(result.keys).toBe('[]');
    expect(result.content).toBe('');
    expect(result.enabled).toBe(1);
    expect(result.position).toBe('before_char');
    expect(result.probability).toBe(100);
    expect(result.vectorized).toBe(0);
    expect(result.character_filter).toBe('{}');
  });
});

describe('normalizeLorebook', () => {
  it('handles ST standalone format (entries as object)', () => {
    const result = normalizeLorebook({
      entries: {
        '0': { key: ['a'], content: 'entry A' },
        '1': { key: ['b'], content: 'entry B' },
      },
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].keys).toBe('["a"]');
    expect(result.entries[0].content).toBe('entry A');
    expect(result.entries[1].content).toBe('entry B');
  });

  it('handles ArcTavern array format', () => {
    const result = normalizeLorebook({
      name: 'Test Book',
      description: 'A test',
      entries: [
        { keys: '["x"]', content: 'entry X' },
        { keys: '["y"]', content: 'entry Y' },
      ],
    });

    expect(result.name).toBe('Test Book');
    expect(result.description).toBe('A test');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].content).toBe('entry X');
  });

  it('handles character_book format', () => {
    const result = normalizeLorebook({
      name: 'CharBook',
      entries: [{ key: ['z'], content: 'from char', position: 0 }],
    });

    expect(result.name).toBe('CharBook');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].position).toBe('before_char');
  });

  it('handles null / empty input', () => {
    expect(normalizeLorebook(null).entries).toHaveLength(0);
    expect(normalizeLorebook(undefined).entries).toHaveLength(0);
    expect(normalizeLorebook({}).entries).toHaveLength(0);
  });
});
