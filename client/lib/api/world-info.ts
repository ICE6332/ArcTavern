import { request, requestBlob } from "./core/http";
import { coalesceRaw, fromRaw, parseJson, toRawRecord } from "./shared/raw";

export interface WorldInfoBook {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldInfoEntry {
  id: number;
  bookId: number;
  uid: number;
  keys: string[];
  secondaryKeys: string[];
  content: string;
  comment: string;
  enabled: boolean;
  insertionOrder: number;
  caseSensitive: boolean;
  priority: number;
  position: string;
  constant: boolean;
  selective: boolean;
  selectLogic: number;
  order: number;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  probability: number;
  useProbability: boolean;
  depth: number;
  groupName: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  automationId: string;
  role: number;
  sticky: number;
  cooldown: number;
  delay: number;
}

function mapWorldInfoBook(rawInput: unknown): WorldInfoBook {
  const raw = toRawRecord(rawInput);

  return {
    id: Number(raw.id),
    name: fromRaw(raw.name, ""),
    description: fromRaw(raw.description, ""),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapWorldInfoEntry(rawInput: unknown): WorldInfoEntry {
  const raw = toRawRecord(rawInput);

  return {
    id: Number(raw.id),
    bookId: Number(coalesceRaw(raw, "book_id", "bookId")),
    uid: Number(raw.uid ?? 0),
    keys: parseJson(raw.keys ?? "[]", []),
    secondaryKeys: parseJson(coalesceRaw(raw, "secondary_keys", "secondaryKeys") ?? "[]", []),
    content: fromRaw(raw.content, ""),
    comment: fromRaw(raw.comment, ""),
    enabled: Boolean(raw.enabled ?? 1),
    insertionOrder: Number(raw.insertion_order ?? raw.insertionOrder ?? 100),
    caseSensitive: Boolean(coalesceRaw(raw, "case_sensitive", "caseSensitive")),
    priority: Number(raw.priority ?? 10),
    position: fromRaw(raw.position, "before_char"),
    constant: Boolean(raw.constant),
    selective: Boolean(raw.selective),
    selectLogic: Number(coalesceRaw(raw, "select_logic", "selectLogic") ?? 0),
    order: Number(raw.order ?? 100),
    excludeRecursion: Boolean(coalesceRaw(raw, "exclude_recursion", "excludeRecursion")),
    preventRecursion: Boolean(coalesceRaw(raw, "prevent_recursion", "preventRecursion")),
    probability: Number(raw.probability ?? 100),
    useProbability: Boolean(coalesceRaw(raw, "use_probability", "useProbability") ?? 1),
    depth: Number(raw.depth ?? 4),
    groupName: fromRaw(coalesceRaw(raw, "group_name", "groupName"), ""),
    groupOverride: Boolean(coalesceRaw(raw, "group_override", "groupOverride")),
    groupWeight: Number(coalesceRaw(raw, "group_weight", "groupWeight") ?? 100),
    scanDepth: Number(coalesceRaw(raw, "scan_depth", "scanDepth") ?? 0),
    matchWholeWords: Boolean(coalesceRaw(raw, "match_whole_words", "matchWholeWords")),
    useGroupScoring: Boolean(coalesceRaw(raw, "use_group_scoring", "useGroupScoring")),
    automationId: fromRaw(coalesceRaw(raw, "automation_id", "automationId"), ""),
    role: Number(raw.role ?? 0),
    sticky: Number(raw.sticky ?? 0),
    cooldown: Number(raw.cooldown ?? 0),
    delay: Number(raw.delay ?? 0),
  };
}

export const worldInfoApi = {
  async getAllBooks() {
    const items = await request<unknown[]>("/world-info");
    return items.map(mapWorldInfoBook);
  },
  async getBook(id: number) {
    const raw = await request<unknown>(`/world-info/${id}`);
    const rawRecord = toRawRecord(raw);
    return {
      ...mapWorldInfoBook(raw),
      entries: Array.isArray(rawRecord.entries) ? rawRecord.entries.map(mapWorldInfoEntry) : [],
    };
  },
  async createBook(data: { name: string; description?: string }) {
    return mapWorldInfoBook(
      await request<unknown>("/world-info", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async updateBook(id: number, data: Partial<WorldInfoBook>) {
    return mapWorldInfoBook(
      await request<unknown>(`/world-info/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    );
  },
  async deleteBook(id: number) {
    return mapWorldInfoBook(await request<unknown>(`/world-info/${id}`, { method: "DELETE" }));
  },
  async createEntry(bookId: number, data: Partial<WorldInfoEntry>) {
    const payload: Record<string, unknown> = { ...data };
    if (data.keys) payload.keys = JSON.stringify(data.keys);
    if (data.secondaryKeys) payload.secondary_keys = JSON.stringify(data.secondaryKeys);
    return mapWorldInfoEntry(
      await request<unknown>(`/world-info/${bookId}/entries`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  },
  async updateEntry(entryId: number, data: Partial<WorldInfoEntry>) {
    const payload: Record<string, unknown> = {};
    if (data.keys !== undefined) payload.keys = JSON.stringify(data.keys);
    if (data.secondaryKeys !== undefined) {
      payload.secondaryKeys = JSON.stringify(data.secondaryKeys);
    }
    if (data.content !== undefined) payload.content = data.content;
    if (data.comment !== undefined) payload.comment = data.comment;
    if (data.enabled !== undefined) payload.enabled = data.enabled ? 1 : 0;
    if (data.insertionOrder !== undefined) payload.insertionOrder = data.insertionOrder;
    if (data.caseSensitive !== undefined) payload.caseSensitive = data.caseSensitive ? 1 : 0;
    if (data.priority !== undefined) payload.priority = data.priority;
    if (data.position !== undefined) payload.position = data.position;
    if (data.constant !== undefined) payload.constant = data.constant ? 1 : 0;
    if (data.selective !== undefined) payload.selective = data.selective ? 1 : 0;
    if (data.selectLogic !== undefined) payload.selectLogic = data.selectLogic;
    if (data.order !== undefined) payload.order = data.order;
    if (data.probability !== undefined) payload.probability = data.probability;
    if (data.depth !== undefined) payload.depth = data.depth;
    if (data.role !== undefined) payload.role = data.role;
    if (data.groupName !== undefined) payload.groupName = data.groupName;
    if (data.sticky !== undefined) payload.sticky = data.sticky;
    if (data.cooldown !== undefined) payload.cooldown = data.cooldown;
    if (data.delay !== undefined) payload.delay = data.delay;
    return mapWorldInfoEntry(
      await request<unknown>(`/world-info/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    );
  },
  async deleteEntry(entryId: number) {
    return mapWorldInfoEntry(
      await request<unknown>(`/world-info/entries/${entryId}`, { method: "DELETE" }),
    );
  },
  async importBook(data: {
    name: string;
    description?: string;
    entries: Array<Record<string, unknown>>;
  }) {
    return mapWorldInfoBook(
      await request<unknown>("/world-info/import", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async exportBook(id: number) {
    return requestBlob(`/world-info/${id}/export`);
  },
};
