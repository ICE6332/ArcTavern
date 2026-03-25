import { getApiBase, request } from "./core/http";
import { readSSE, type GroupStreamChunk } from "./core/stream";
import { coalesceRaw, fromRaw, parseJson, toRawRecord } from "./shared/raw";
import type { CompletionRequest } from "./types";

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
    disabledMembers: parseJson(
      coalesceRaw(raw, "disabled_members", "disabledMembers") ?? "[]",
      [],
    ),
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
    return mapGroup(
      await request<unknown>("/groups", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async update(id: string, data: Partial<Group>) {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.avatarUrl !== undefined) payload.avatarUrl = data.avatarUrl;
    if (data.allowSelfResponses !== undefined) {
      payload.allowSelfResponses = data.allowSelfResponses ? 1 : 0;
    }
    if (data.activationStrategy !== undefined) payload.activationStrategy = data.activationStrategy;
    if (data.generationMode !== undefined) payload.generationMode = data.generationMode;
    if (data.disabledMembers !== undefined) {
      payload.disabledMembers = JSON.stringify(data.disabledMembers);
    }
    if (data.fav !== undefined) payload.fav = data.fav ? 1 : 0;
    if (data.autoModeDelay !== undefined) payload.autoModeDelay = data.autoModeDelay;
    if (data.joinPrefix !== undefined) payload.joinPrefix = data.joinPrefix;
    if (data.joinSuffix !== undefined) payload.joinSuffix = data.joinSuffix;
    return mapGroup(
      await request<unknown>(`/groups/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    );
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
    const items = await request<unknown[]>(`/groups/${id}/members/${characterId}`, {
      method: "DELETE",
    });
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
