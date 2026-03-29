/**
 * Unified field normalizer for SillyTavern world info / lorebook formats.
 *
 * Handles three import paths:
 *   1. ST standalone lorebook .json  — { entries: { "0": {...}, "1": {...} } }
 *   2. ArcTavern array format        — { entries: [...] }
 *   3. TavernCard V2 character_book  — { entries: [...], name?: string }
 */

/** Normalized entry ready for WorldInfoService.createEntry() */
export interface NormalizedWIEntry {
  [key: string]: string | number;
  keys: string;
  secondary_keys: string;
  content: string;
  comment: string;
  enabled: number;
  insertion_order: number;
  case_sensitive: number;
  priority: number;
  position: string;
  extensions: string;
  constant: number;
  selective: number;
  select_logic: number;
  order: number;
  exclude_recursion: number;
  prevent_recursion: number;
  probability: number;
  use_probability: number;
  depth: number;
  group_name: string;
  group_override: number;
  group_weight: number;
  scan_depth: number;
  match_whole_words: number;
  use_group_scoring: number;
  automation_id: string;
  role: number;
  sticky: number;
  cooldown: number;
  delay: number;
  triggers: string;
  vectorized: number;
  ignore_budget: number;
  match_persona_desc: number;
  match_char_desc: number;
  match_char_personality: number;
  match_scenario: number;
  delay_until_recursion: number;
  character_filter: string;
}

export interface NormalizedLorebook {
  name: string;
  description: string;
  entries: NormalizedWIEntry[];
}

// ST position number → ArcTavern string
const POSITION_MAP: Record<number, string> = {
  0: 'before_char',
  1: 'after_char',
  2: 'before_an',
  3: 'after_an',
  4: 'at_depth',
  5: 'before_example',
  6: 'after_example',
};

function toJsonArray(val: unknown): string {
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return val;
    } catch {
      /* ignore */
    }
    return JSON.stringify(
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return '[]';
}

function toJsonObject(val: unknown): string {
  if (typeof val === 'string') {
    try {
      JSON.parse(val);
      return val;
    } catch {
      return '{}';
    }
  }
  if (val && typeof val === 'object') return JSON.stringify(val);
  return '{}';
}

function toBool(val: unknown): number {
  return val ? 1 : 0;
}

function toInt(val: unknown, fallback: number): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Normalize a single entry from any ST-compatible format into DB-ready shape.
 * Handles both character_book V2 field names and ST internal field names.
 */
export function normalizeEntry(e: Record<string, unknown>): NormalizedWIEntry {
  const position =
    typeof e.position === 'number'
      ? (POSITION_MAP[e.position] ?? 'before_char')
      : typeof e.position === 'string'
        ? e.position
        : 'before_char';

  return {
    keys: toJsonArray(e.keys ?? e.key),
    secondary_keys: toJsonArray(e.secondary_keys ?? e.keysecondary),
    content: String(e.content ?? ''),
    comment: String(e.comment ?? e.name ?? ''),
    enabled:
      e.enabled === false || e.disable === true
        ? 0
        : e.enabled !== undefined
          ? toBool(e.enabled)
          : 1,
    insertion_order: toInt(e.insertion_order ?? e.order, 100),
    case_sensitive: toBool(e.case_sensitive ?? e.caseSensitive),
    priority: toInt(e.priority, 10),
    position,
    extensions: toJsonObject(e.extensions),
    constant: toBool(e.constant),
    selective: e.selective !== undefined ? toBool(e.selective) : 0,
    select_logic: toInt(e.select_logic ?? e.selectiveLogic, 0),
    order: toInt(e.order ?? e.insertion_order, 100),
    exclude_recursion: toBool(e.exclude_recursion ?? e.excludeRecursion),
    prevent_recursion: toBool(e.prevent_recursion ?? e.preventRecursion),
    probability: toInt(e.probability, 100),
    use_probability:
      e.use_probability !== undefined
        ? toBool(e.use_probability)
        : e.useProbability !== undefined
          ? toBool(e.useProbability)
          : 1,
    depth: toInt(e.depth, 4),
    group_name: String(e.group_name ?? e.group ?? ''),
    group_override: toBool(e.group_override ?? e.groupOverride),
    group_weight: toInt(e.group_weight ?? e.groupWeight, 100),
    scan_depth: toInt(e.scan_depth ?? e.scanDepth, 0),
    match_whole_words: toBool(e.match_whole_words ?? e.matchWholeWords),
    use_group_scoring: toBool(e.use_group_scoring ?? e.useGroupScoring),
    automation_id: String(e.automation_id ?? e.automationId ?? ''),
    role: toInt(e.role, 0),
    sticky: toInt(e.sticky, 0),
    cooldown: toInt(e.cooldown, 0),
    delay: toInt(e.delay, 0),
    triggers: toJsonArray(e.triggers),
    vectorized: toBool(e.vectorized),
    ignore_budget: toBool(e.ignore_budget ?? e.ignoreBudget),
    match_persona_desc: toBool(e.match_persona_desc ?? e.matchPersonaDescription),
    match_char_desc: toBool(e.match_char_desc ?? e.matchCharacterDescription),
    match_char_personality: toBool(e.match_char_personality ?? e.matchCharacterPersonality),
    match_scenario: toBool(e.match_scenario ?? e.matchScenario ?? e.matchCharacterScenario),
    delay_until_recursion: toInt(e.delay_until_recursion ?? e.delayUntilRecursion, 0),
    character_filter: toJsonObject(e.character_filter ?? e.characterFilter),
  };
}

/**
 * Normalize a lorebook from any format (ST standalone, ArcTavern array, character_book).
 *
 * ST standalone format:  { entries: { "0": {...}, "1": {...} } }
 * Array format:          { entries: [...] }
 * character_book:        { entries: [...], name?: string, description?: string }
 */
export function normalizeLorebook(raw: unknown): NormalizedLorebook {
  if (!raw || typeof raw !== 'object') {
    return { name: '', description: '', entries: [] };
  }

  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name : '';
  const description = typeof obj.description === 'string' ? obj.description : '';

  let rawEntries: Array<Record<string, unknown>> = [];

  if (obj.entries && typeof obj.entries === 'object') {
    if (Array.isArray(obj.entries)) {
      // ArcTavern array or character_book array
      rawEntries = obj.entries.filter(
        (e): e is Record<string, unknown> => e != null && typeof e === 'object',
      );
    } else {
      // ST standalone format: entries is an object with string-integer keys
      rawEntries = Object.values(obj.entries as Record<string, unknown>).filter(
        (e): e is Record<string, unknown> => e != null && typeof e === 'object',
      );
    }
  }

  return {
    name,
    description,
    entries: rawEntries.map(normalizeEntry),
  };
}
