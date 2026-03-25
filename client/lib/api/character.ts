import { getApiBase, request, requestBlob } from "./core/http";
import { coalesceRaw, fromRaw, parseJson, toRawRecord } from "./shared/raw";

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
  worldInfoBookId: number | null;
  createdAt: string;
  updatedAt: string;
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
    postHistoryInstructions: fromRaw(
      coalesceRaw(raw, "post_history_instructions", "postHistoryInstructions"),
      "",
    ),
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
    worldInfoBookId: raw.world_info_book_id != null ? Number(raw.world_info_book_id) : null,
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
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
    payload.characterBook = data.characterBook ? JSON.stringify(data.characterBook) : null;
  }

  return payload;
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
