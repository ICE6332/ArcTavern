import { jsonSchema, parseJsonEventStream } from "ai";

const EXPLICIT_API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "")
  .trim()
  .replace(/\/+$/, "");

function getApiBase() {
  if (EXPLICIT_API_BASE) return EXPLICIT_API_BASE;

  // In local dev, bypass Next rewrite proxy for streaming stability.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
  }

  return "/api";
}

type RawRecord = Record<string, unknown>;

function toRawRecord(value: unknown): RawRecord {
  if (value && typeof value === "object") {
    return value as RawRecord;
  }
  return {};
}

function coalesceRaw(raw: RawRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function fromRaw<T>(value: unknown, fallback: T): T {
  return (value as T | null | undefined) ?? fallback;
}

type StreamChunk = { content?: string; error?: string };
type GroupStreamChunk = StreamChunk & { speaker?: string; speakerId?: number };
const streamChunkSchema = jsonSchema<StreamChunk & { speaker?: string; speakerId?: number }>({
  type: "object",
  properties: {
    content: { type: "string" },
    error: { type: "string" },
    speaker: { type: "string" },
    speakerId: { type: "number" },
  },
  additionalProperties: true,
});

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return (value as T) ?? fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await fetch(`${getApiBase()}${path}`, options);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.blob();
}

function mapCharacter(rawInput: unknown): Character {
  const raw = toRawRecord(rawInput);
  return {
    id: Number(raw.id),
    name: fromRaw(raw.name, ""),
    avatar: fromRaw(raw.avatar, null),
    description: fromRaw(raw.description, ""),
    personality: fromRaw(raw.personality, ""),
    firstMes: fromRaw(coalesceRaw(raw, "first_mes", "firstMes"), ""),
    mesExample: fromRaw(coalesceRaw(raw, "mes_example", "mesExample"), ""),
    scenario: fromRaw(raw.scenario, ""),
    systemPrompt: fromRaw(coalesceRaw(raw, "system_prompt", "systemPrompt"), ""),
    postHistoryInstructions:
      fromRaw(coalesceRaw(raw, "post_history_instructions", "postHistoryInstructions"), ""),
    alternateGreetings: parseJson<string[]>(
      coalesceRaw(raw, "alternate_greetings", "alternateGreetings") ?? "[]",
      [],
    ),
    creator: fromRaw(raw.creator, ""),
    creatorNotes: fromRaw(coalesceRaw(raw, "creator_notes", "creatorNotes"), ""),
    characterVersion: fromRaw(coalesceRaw(raw, "character_version", "characterVersion"), ""),
    tags: parseJson<string[]>(raw.tags ?? "[]", []),
    spec: fromRaw(raw.spec, "chara_card_v2"),
    specVersion: fromRaw(coalesceRaw(raw, "spec_version", "specVersion"), "2.0"),
    extensions: parseJson<Record<string, unknown>>(raw.extensions ?? "{}", {}),
    characterBook: parseJson<Record<string, unknown> | null>(
      coalesceRaw(raw, "character_book", "characterBook") ?? null,
      null,
    ),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapChat(rawInput: unknown): Chat {
  const raw = toRawRecord(rawInput);
  return {
    id: Number(raw.id),
    characterId: Number(coalesceRaw(raw, "character_id", "characterId")),
    name: fromRaw(raw.name, ""),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapMessage(rawInput: unknown): Message {
  const raw = toRawRecord(rawInput);
  return {
    id: Number(raw.id),
    chatId: Number(coalesceRaw(raw, "chat_id", "chatId")),
    role: fromRaw(raw.role, "assistant") as Message["role"],
    name: fromRaw(raw.name, ""),
    content: fromRaw(raw.content, ""),
    isHidden: Boolean(coalesceRaw(raw, "is_hidden", "isHidden")),
    swipeId: Number(coalesceRaw(raw, "swipe_id", "swipeId") ?? 0),
    swipes: parseJson<string[]>(raw.swipes ?? "[]", []),
    genStarted: fromRaw(coalesceRaw(raw, "gen_started", "genStarted"), null),
    genFinished: fromRaw(coalesceRaw(raw, "gen_finished", "genFinished"), null),
    extra: parseJson<Record<string, unknown>>(raw.extra ?? "{}", {}),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
  };
}

function toCharacterPayload(data: Partial<Character>) {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.avatar !== undefined) payload.avatar = data.avatar;
  if (data.description !== undefined) payload.description = data.description;
  if (data.personality !== undefined) payload.personality = data.personality;
  if (data.firstMes !== undefined) payload.firstMes = data.firstMes;
  if (data.mesExample !== undefined) payload.mesExample = data.mesExample;
  if (data.scenario !== undefined) payload.scenario = data.scenario;
  if (data.systemPrompt !== undefined) payload.systemPrompt = data.systemPrompt;
  if (data.postHistoryInstructions !== undefined) {
    payload.postHistoryInstructions = data.postHistoryInstructions;
  }
  if (data.alternateGreetings !== undefined) {
    payload.alternateGreetings = JSON.stringify(data.alternateGreetings);
  }
  if (data.creator !== undefined) payload.creator = data.creator;
  if (data.creatorNotes !== undefined) payload.creatorNotes = data.creatorNotes;
  if (data.characterVersion !== undefined) {
    payload.characterVersion = data.characterVersion;
  }
  if (data.tags !== undefined) payload.tags = JSON.stringify(data.tags);
  if (data.extensions !== undefined) {
    payload.extensions = JSON.stringify(data.extensions);
  }
  if (data.characterBook !== undefined) {
    payload.characterBook = data.characterBook
      ? JSON.stringify(data.characterBook)
      : null;
  }
  return payload;
}

async function* readSSE<T extends StreamChunk = StreamChunk>(
  url: string,
  options: RequestInit,
  signal?: AbortSignal,
): AsyncGenerator<T, void, unknown> {
  const res = await fetch(url, { ...options, signal });
  if (!res.ok) {
    let details = "";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const message =
            (typeof parsed.message === "string" && parsed.message) ||
            (typeof parsed.error === "string" && parsed.error) ||
            raw;
          details = ` - ${message}`;
        } catch {
          details = ` - ${raw}`;
        }
      }
    } catch {
      // Ignore response parsing failure and keep status-only error.
    }
    throw new Error(`Stream error: ${res.status}${details}`);
  }
  if (!res.body) throw new Error("No response body");

  const parsed = parseJsonEventStream({
    stream: res.body,
    schema: streamChunkSchema,
  });
  const reader = parsed.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value.success) {
        throw value.error;
      }
      yield value.value as T;
    }
  } finally {
    reader.releaseLock();
  }
}

export const characterApi = {
  async getAll() {
    const items = await request<unknown[]>("/characters");
    return items.map(mapCharacter);
  },
  async getOne(id: number) {
    const item = await request<unknown>(`/characters/${id}`);
    return mapCharacter(item);
  },
  async create(data: Partial<Character>) {
    const item = await request<unknown>("/characters", {
      method: "POST",
      body: JSON.stringify(toCharacterPayload(data)),
    });
    return mapCharacter(item);
  },
  async update(id: number, data: Partial<Character>) {
    const item = await request<unknown>(`/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(toCharacterPayload(data)),
    });
    return mapCharacter(item);
  },
  async delete(id: number) {
    const item = await request<unknown>(`/characters/${id}`, { method: "DELETE" });
    return mapCharacter(item);
  },
  async import(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getApiBase()}/characters/import`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`API Error ${res.status}: ${error}`);
    }
    return mapCharacter(await res.json());
  },
  async export(id: number, format: "json" | "png" = "json") {
    return requestBlob(`/characters/export/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
  },
  async duplicate(id: number) {
    const item = await request<unknown>(`/characters/duplicate/${id}`, {
      method: "POST",
    });
    return mapCharacter(item);
  },
  async updateAvatar(id: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getApiBase()}/characters/${id}/avatar`, {
      method: "PATCH",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`API Error ${res.status}: ${error}`);
    }
    return mapCharacter(await res.json());
  },
  avatarUrl(id: number) {
    return `${getApiBase()}/characters/${id}/avatar`;
  },
};

// --- RAG API ---

export interface RagSettings {
  enabled: boolean;
  embeddingProvider: string;
  embeddingModel: string;
  scope: "chat" | "character";
  maxResults: number;
  minScore: number;
  maxTokenBudget: number;
  chunkSize: number;
  chunkOverlap: number;
  insertionPosition: "before_char" | "after_char" | "at_depth";
  insertionDepth: number;
}

export const ragApi = {
  getSettings: () => request<RagSettings>("/rag/settings"),
  updateSettings: (data: Partial<RagSettings>) =>
    request<RagSettings>("/rag/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteChatVectors: (chatId: number) =>
    request<{ deleted: boolean }>(`/rag/chat/${chatId}/vectors`, {
      method: "DELETE",
    }),
  deleteMessageVectors: (messageId: number) =>
    request<{ deleted: boolean }>(`/rag/message/${messageId}/vectors`, {
      method: "DELETE",
    }),
  deleteCharacterVectors: (characterId: number) =>
    request<{ deleted: boolean }>(`/rag/character/${characterId}/vectors`, {
      method: "DELETE",
    }),
};

export const chatApi = {
  async getByCharacter(characterId: number) {
    const items = await request<unknown[]>(`/chats?characterId=${characterId}`);
    return items.map(mapChat);
  },
  async getOne(id: number) {
    const item = await request<unknown>(`/chats/${id}`);
    return mapChat(item);
  },
  async create(characterId: number, name?: string) {
    const item = await request<unknown>("/chats", {
      method: "POST",
      body: JSON.stringify({ characterId, name }),
    });
    return mapChat(item);
  },
  async delete(id: number) {
    const item = await request<unknown>(`/chats/${id}`, { method: "DELETE" });
    return mapChat(item);
  },
  async getMessages(chatId: number) {
    const items = await request<unknown[]>(`/chats/${chatId}/messages`);
    return items.map(mapMessage);
  },
  async addMessage(chatId: number, data: { role: string; content: string; name?: string }) {
    const item = await request<unknown>(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return mapMessage(item);
  },
  async updateMessage(messageId: number, data: Partial<Message>) {
    const payload: Record<string, unknown> = {};
    if (data.content !== undefined) payload.content = data.content;
    if (data.name !== undefined) payload.name = data.name;
    if (data.isHidden !== undefined) payload.isHidden = data.isHidden;
    if (data.swipeId !== undefined) payload.swipeId = data.swipeId;
    if (data.swipes !== undefined) payload.swipes = JSON.stringify(data.swipes);
    if (data.genStarted !== undefined) payload.genStarted = data.genStarted;
    if (data.genFinished !== undefined) payload.genFinished = data.genFinished;
    if (data.extra !== undefined) payload.extra = JSON.stringify(data.extra);
    const item = await request<unknown>(`/chats/messages/${messageId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return mapMessage(item);
  },
  async deleteMessage(messageId: number) {
    const item = await request<unknown>(`/chats/messages/${messageId}`, {
      method: "DELETE",
    });
    return mapMessage(item);
  },
  async *generate(
    chatId: number,
    payload: Omit<CompletionRequest, "messages" | "stream"> & {
      type?: GenerationType;
      message?: string;
      userName?: string;
      maxContext?: number;
    },
    signal?: AbortSignal,
  ) {
    for await (const chunk of readSSE(
      `${getApiBase()}/chat/${chatId}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      signal,
    )) {
      yield chunk;
    }
  },
  async stop(chatId: number) {
    return request<{ stopped: boolean }>(`/chat/${chatId}/stop`, {
      method: "POST",
    });
  },
  async swipe(
    messageId: number,
    payload: { direction?: "left" | "right"; swipeId?: number; content?: string },
  ) {
    const item = await request<unknown>(`/messages/${messageId}/swipe`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return mapMessage(item);
  },
};

export const aiApi = {
  async complete(data: CompletionRequest) {
    return request<{ content: string; model: string; finishReason: string }>("/ai/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async tokenize(data: { text?: string; messages?: CompletionRequest["messages"] }) {
    return request<{ tokens: number; method: string }>("/ai/tokenize", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async models(provider?: Provider) {
    const suffix = provider ? `?provider=${provider}` : "";
    return request<unknown>(`/ai/models${suffix}`);
  },
  async *streamChat(data: CompletionRequest, signal?: AbortSignal) {
    for await (const chunk of readSSE(
      `${getApiBase()}/ai/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, stream: true }),
      },
      signal,
    )) {
      yield chunk;
    }
  },
  async healthCheck(req: {
    provider: string;
    apiKey?: string;
    baseUrl: string;
  }) {
    return request<{
      status: "ok" | "error";
      message: string;
      latency?: number;
      models?: Array<{ id: string; contextWindow?: number }>;
    }>("/ai-provider/health-check", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
  async discoverModels(provider: string, baseUrl: string) {
    return request<Array<{ id: string; contextWindow?: number }>>(
      `/ai-provider/models/discover?provider=${encodeURIComponent(provider)}&baseUrl=${encodeURIComponent(baseUrl)}`,
    );
  },
  async testRequest(req: {
    provider: string;
    apiKey: string;
    baseUrl: string;
    body: Record<string, unknown>;
  }) {
    return request<unknown>("/ai-provider/test-request", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};

export const secretApi = {
  listKeys: () => request<string[]>("/secrets"),
  set: (key: string, value: string) =>
    request("/secrets", { method: "POST", body: JSON.stringify({ key, value }) }),
  delete: (key: string) => request(`/secrets/${key}`, { method: "DELETE" }),
};

export const presetApi = {
  async getAll(apiType?: string) {
    const items = await request<unknown[]>(
      `/presets${apiType ? `?apiType=${encodeURIComponent(apiType)}` : ""}`,
    );
    return items.map(mapPreset);
  },
  async getOne(id: number) {
    return mapPreset(await request<unknown>(`/presets/${id}`));
  },
  async create(data: { name: string; apiType: string; data: string }) {
    return mapPreset(
      await request<unknown>("/presets", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async update(id: number, data: Partial<Preset>) {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.apiType !== undefined) payload.apiType = data.apiType;
    if (data.data !== undefined) payload.data = data.data;
    return mapPreset(
      await request<unknown>(`/presets/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    );
  },
  async delete(id: number) {
    return mapPreset(await request<unknown>(`/presets/${id}`, { method: "DELETE" }));
  },
  async import(name: string, apiType: string, data: Record<string, unknown>): Promise<Preset> {
    return mapPreset(
      await request<unknown>("/presets/import", {
        method: "POST",
        body: JSON.stringify({ name, apiType, data }),
      }),
    );
  },
  async export(id: number): Promise<{ name: string; apiType: string; data: Record<string, unknown> }> {
    return request(`/presets/${id}/export`);
  },
  async restore(id: number): Promise<{ isDefault: boolean; preset: Record<string, unknown> }> {
    return request(`/presets/${id}/restore`, { method: "POST" });
  },
  async getDefaults(apiType: string): Promise<string[]> {
    return request(`/presets/defaults/${apiType}`);
  },
};

export const settingsApi = {
  getAll: () => request<Record<string, unknown>>("/settings"),
  get: (key: string) => request(`/settings/${key}`),
  set: (key: string, value: unknown) =>
    request("/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
};

function mapPreset(rawInput: unknown): Preset {
  const raw = toRawRecord(rawInput);
  return {
    id: Number(raw.id),
    name: fromRaw(raw.name, ""),
    apiType: fromRaw(coalesceRaw(raw, "api_type", "apiType"), ""),
    data: fromRaw(raw.data, "{}"),
    isDefault: Boolean(coalesceRaw(raw, "is_default", "isDefault")),
    sourceHash: fromRaw(coalesceRaw(raw, "source_hash", "sourceHash"), null),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "mistral"
  | "custom";

export type GenerationType =
  | "normal"
  | "regenerate"
  | "swipe"
  | "continue"
  | "impersonate"
  | "quiet";

export interface Character {
  id: number;
  name: string;
  avatar: string | null;
  description: string;
  personality: string;
  firstMes: string;
  mesExample: string;
  scenario: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  alternateGreetings: string[];
  creator: string;
  creatorNotes: string;
  characterVersion: string;
  tags: string[];
  spec: string;
  specVersion: string;
  extensions: Record<string, unknown>;
  characterBook: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: number;
  characterId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  chatId: number;
  role: "user" | "assistant" | "system" | "tool";
  name: string;
  content: string;
  isHidden: boolean;
  swipeId: number;
  swipes: string[];
  genStarted: string | null;
  genFinished: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
}

export interface Preset {
  id: number;
  name: string;
  apiType: string;
  data: string;
  isDefault: boolean;
  sourceHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionRequest {
  provider: Provider;
  model: string;
  messages: {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  tools?: unknown[];
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: string; function: { name: string } };
  assistantPrefill?: string;
  jsonSchema?: { name: string; description?: string; value: object };
  reasoningEffort?: string;
  reverseProxy?: string;
}

// ─── Tag Types & API ───

export interface Tag {
  id: string;
  name: string;
  folderType: string;
  sortOrder: number;
  color: string | null;
  color2: string | null;
  isHidden: boolean;
  createdAt: string;
}

function mapTag(rawInput: unknown): Tag {
  const raw = toRawRecord(rawInput);
  return {
    id: fromRaw(raw.id, ""),
    name: fromRaw(raw.name, ""),
    folderType: fromRaw(coalesceRaw(raw, "folder_type", "folderType"), "NONE"),
    sortOrder: Number(coalesceRaw(raw, "sort_order", "sortOrder") ?? 0),
    color: fromRaw(raw.color, null),
    color2: fromRaw(raw.color2, null),
    isHidden: Boolean(coalesceRaw(raw, "is_hidden", "isHidden")),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
  };
}

export const tagApi = {
  async getAll() {
    const items = await request<unknown[]>("/tags");
    return items.map(mapTag);
  },
  async getOne(id: string) {
    return mapTag(await request<unknown>(`/tags/${id}`));
  },
  async create(data: { name: string; folderType?: string; sortOrder?: number; color?: string; color2?: string }) {
    return mapTag(await request<unknown>("/tags", { method: "POST", body: JSON.stringify(data) }));
  },
  async update(id: string, data: Partial<Tag>) {
    return mapTag(await request<unknown>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  },
  async delete(id: string) {
    return mapTag(await request<unknown>(`/tags/${id}`, { method: "DELETE" }));
  },
  async assign(entityType: string, entityId: string, tagId: string) {
    return request("/tags/assign", {
      method: "POST",
      body: JSON.stringify({ entityType, entityId, tagId }),
    });
  },
  async unassign(entityType: string, entityId: string, tagId: string) {
    return request("/tags/unassign", {
      method: "DELETE",
      body: JSON.stringify({ entityType, entityId, tagId }),
    });
  },
  async getEntityTags(entityType: string, entityId: string) {
    const items = await request<unknown[]>(`/tags/entity/${entityType}/${entityId}`);
    return items.map(mapTag);
  },
};

// ─── Persona Types & API ───

export interface Persona {
  id: string;
  name: string;
  description: string;
  position: number;
  depth: number;
  role: number;
  lorebookId: number | null;
  title: string | null;
  isDefault: boolean;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaConnection {
  personaId: string;
  entityType: string;
  entityId: string;
}

function mapPersona(rawInput: unknown): Persona {
  const raw = toRawRecord(rawInput);
  return {
    id: fromRaw(raw.id, ""),
    name: fromRaw(raw.name, ""),
    description: fromRaw(raw.description, ""),
    position: Number(raw.position ?? 0),
    depth: Number(raw.depth ?? 2),
    role: Number(raw.role ?? 0),
    lorebookId: fromRaw(coalesceRaw(raw, "lorebook_id", "lorebookId"), null),
    title: fromRaw(raw.title, null),
    isDefault: Boolean(coalesceRaw(raw, "is_default", "isDefault")),
    avatarPath: fromRaw(coalesceRaw(raw, "avatar_path", "avatarPath"), null),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapPersonaConnection(rawInput: unknown): PersonaConnection {
  const raw = toRawRecord(rawInput);
  return {
    personaId: fromRaw(coalesceRaw(raw, "persona_id", "personaId"), ""),
    entityType: fromRaw(coalesceRaw(raw, "entity_type", "entityType"), ""),
    entityId: fromRaw(coalesceRaw(raw, "entity_id", "entityId"), ""),
  };
}

export const personaApi = {
  async getAll() {
    const items = await request<unknown[]>("/personas");
    return items.map(mapPersona);
  },
  async getOne(id: string) {
    return mapPersona(await request<unknown>(`/personas/${id}`));
  },
  async getDefault() {
    const raw = await request<unknown>("/personas/default");
    return raw ? mapPersona(raw) : null;
  },
  async create(data: { name: string; description?: string; position?: number; depth?: number; role?: number; isDefault?: boolean }) {
    return mapPersona(await request<unknown>("/personas", { method: "POST", body: JSON.stringify(data) }));
  },
  async update(id: string, data: Partial<Persona>) {
    return mapPersona(await request<unknown>(`/personas/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  },
  async delete(id: string) {
    return mapPersona(await request<unknown>(`/personas/${id}`, { method: "DELETE" }));
  },
  async uploadAvatar(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getApiBase()}/personas/${id}/avatar`, { method: "POST", body: formData });
    if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
    return mapPersona(await res.json());
  },
  async getConnections(id: string) {
    const items = await request<unknown[]>(`/personas/${id}/connections`);
    return items.map(mapPersonaConnection);
  },
  async updateConnections(id: string, connections: Array<{ entityType: string; entityId: string }>) {
    const items = await request<unknown[]>(`/personas/${id}/connections`, {
      method: "PUT",
      body: JSON.stringify({ connections }),
    });
    return items.map(mapPersonaConnection);
  },
  async findForEntity(entityType: string, entityId: string) {
    const items = await request<unknown[]>(`/personas/for/${entityType}/${entityId}`);
    return items.map(mapPersona);
  },
};

// ─── World Info Types & API ───

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
      entries: Array.isArray(rawRecord.entries)
        ? rawRecord.entries.map(mapWorldInfoEntry)
        : [],
    };
  },
  async createBook(data: { name: string; description?: string }) {
    return mapWorldInfoBook(await request<unknown>("/world-info", { method: "POST", body: JSON.stringify(data) }));
  },
  async updateBook(id: number, data: Partial<WorldInfoBook>) {
    return mapWorldInfoBook(await request<unknown>(`/world-info/${id}`, { method: "PUT", body: JSON.stringify(data) }));
  },
  async deleteBook(id: number) {
    return mapWorldInfoBook(await request<unknown>(`/world-info/${id}`, { method: "DELETE" }));
  },
  async createEntry(bookId: number, data: Partial<WorldInfoEntry>) {
    const payload: Record<string, unknown> = { ...data };
    if (data.keys) payload.keys = JSON.stringify(data.keys);
    if (data.secondaryKeys) payload.secondary_keys = JSON.stringify(data.secondaryKeys);
    return mapWorldInfoEntry(await request<unknown>(`/world-info/${bookId}/entries`, { method: "POST", body: JSON.stringify(payload) }));
  },
  async updateEntry(entryId: number, data: Partial<WorldInfoEntry>) {
    const payload: Record<string, unknown> = {};
    if (data.keys !== undefined) payload.keys = JSON.stringify(data.keys);
    if (data.secondaryKeys !== undefined) payload.secondaryKeys = JSON.stringify(data.secondaryKeys);
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
    return mapWorldInfoEntry(await request<unknown>(`/world-info/entries/${entryId}`, { method: "PUT", body: JSON.stringify(payload) }));
  },
  async deleteEntry(entryId: number) {
    return mapWorldInfoEntry(await request<unknown>(`/world-info/entries/${entryId}`, { method: "DELETE" }));
  },
  async importBook(data: { name: string; description?: string; entries: Array<Record<string, unknown>> }) {
    return mapWorldInfoBook(await request<unknown>("/world-info/import", { method: "POST", body: JSON.stringify(data) }));
  },
  async exportBook(id: number) {
    return requestBlob(`/world-info/${id}/export`);
  },
};

// ─── Group Types & API ───

export interface Group {
  id: string;
  name: string;
  avatarUrl: string | null;
  allowSelfResponses: boolean;
  activationStrategy: number;
  generationMode: number;
  disabledMembers: number[];
  fav: boolean;
  currentChatId: number | null;
  autoModeDelay: number;
  joinPrefix: string;
  joinSuffix: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  groupId: string;
  characterId: number;
  sortOrder: number;
}

function mapGroup(rawInput: unknown): Group {
  const raw = toRawRecord(rawInput);
  return {
    id: fromRaw(raw.id, ""),
    name: fromRaw(raw.name, ""),
    avatarUrl: fromRaw(coalesceRaw(raw, "avatar_url", "avatarUrl"), null),
    allowSelfResponses: Boolean(coalesceRaw(raw, "allow_self_responses", "allowSelfResponses")),
    activationStrategy: Number(coalesceRaw(raw, "activation_strategy", "activationStrategy") ?? 0),
    generationMode: Number(coalesceRaw(raw, "generation_mode", "generationMode") ?? 0),
    disabledMembers: parseJson(coalesceRaw(raw, "disabled_members", "disabledMembers") ?? "[]", []),
    fav: Boolean(raw.fav),
    currentChatId: fromRaw(coalesceRaw(raw, "current_chat_id", "currentChatId"), null),
    autoModeDelay: Number(coalesceRaw(raw, "auto_mode_delay", "autoModeDelay") ?? 5),
    joinPrefix: fromRaw(coalesceRaw(raw, "join_prefix", "joinPrefix"), ""),
    joinSuffix: fromRaw(coalesceRaw(raw, "join_suffix", "joinSuffix"), ""),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapGroupMember(rawInput: unknown): GroupMember {
  const raw = toRawRecord(rawInput);
  return {
    groupId: fromRaw(coalesceRaw(raw, "group_id", "groupId"), ""),
    characterId: Number(coalesceRaw(raw, "character_id", "characterId")),
    sortOrder: Number(coalesceRaw(raw, "sort_order", "sortOrder") ?? 0),
  };
}

export const groupApi = {
  async getAll() {
    const items = await request<unknown[]>("/groups");
    return items.map(mapGroup);
  },
  async getOne(id: string) {
    return mapGroup(await request<unknown>(`/groups/${id}`));
  },
  async create(data: { name: string; activationStrategy?: number; generationMode?: number }) {
    return mapGroup(await request<unknown>("/groups", { method: "POST", body: JSON.stringify(data) }));
  },
  async update(id: string, data: Partial<Group>) {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.avatarUrl !== undefined) payload.avatarUrl = data.avatarUrl;
    if (data.allowSelfResponses !== undefined) payload.allowSelfResponses = data.allowSelfResponses ? 1 : 0;
    if (data.activationStrategy !== undefined) payload.activationStrategy = data.activationStrategy;
    if (data.generationMode !== undefined) payload.generationMode = data.generationMode;
    if (data.disabledMembers !== undefined) payload.disabledMembers = JSON.stringify(data.disabledMembers);
    if (data.fav !== undefined) payload.fav = data.fav ? 1 : 0;
    if (data.autoModeDelay !== undefined) payload.autoModeDelay = data.autoModeDelay;
    if (data.joinPrefix !== undefined) payload.joinPrefix = data.joinPrefix;
    if (data.joinSuffix !== undefined) payload.joinSuffix = data.joinSuffix;
    return mapGroup(await request<unknown>(`/groups/${id}`, { method: "PUT", body: JSON.stringify(payload) }));
  },
  async delete(id: string) {
    return mapGroup(await request<unknown>(`/groups/${id}`, { method: "DELETE" }));
  },
  async getMembers(id: string) {
    const items = await request<unknown[]>(`/groups/${id}/members`);
    return items.map(mapGroupMember);
  },
  async addMember(id: string, characterId: number) {
    const items = await request<unknown[]>(`/groups/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ characterId }),
    });
    return items.map(mapGroupMember);
  },
  async removeMember(id: string, characterId: number) {
    const items = await request<unknown[]>(`/groups/${id}/members/${characterId}`, { method: "DELETE" });
    return items.map(mapGroupMember);
  },
  async *generate(
    groupId: string,
    payload: Omit<CompletionRequest, "messages" | "stream"> & {
      chatId: number;
      message?: string;
      userName?: string;
      maxContext?: number;
      characterId?: number;
    },
    signal?: AbortSignal,
  ) {
    for await (const chunk of readSSE<GroupStreamChunk>(
      `${getApiBase()}/groups/${groupId}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      signal,
    )) {
      yield chunk;
    }
  },
};
