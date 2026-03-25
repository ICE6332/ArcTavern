import type { PartialStructuredResponse } from "@/lib/openui/structured-types";
import { isStructuredResponse } from "@/lib/openui/structured-types";
import { getApiBase, request } from "./core/http";
import { readSSE } from "./core/stream";
import { coalesceRaw, fromRaw, parseJson, toRawRecord } from "./shared/raw";
import type { CompletionRequest, GenerationType } from "./types";

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
  reasoning?: string;
  reasoningSwipes?: string[];
  structuredContent?: PartialStructuredResponse | null;
  isHidden: boolean;
  swipeId: number;
  swipes: string[];
  genStarted: string | null;
  genFinished: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
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

export function parseStructuredMessageContent(
  content: string,
  extra: Record<string, unknown>,
): PartialStructuredResponse | null {
  if (extra.format !== "structured" || !content) {
    return null;
  }

  const parsed = parseJson<unknown>(content, null);

  if (isStructuredResponse(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return { blocks: parsed };
  }

  return null;
}

export function mapMessage(rawInput: unknown): Message {
  const raw = toRawRecord(rawInput);
  const content = fromRaw(raw.content, "");
  const extra = parseJson<Record<string, unknown>>(raw.extra ?? "{}", {});
  const reasoningSwipes = Array.isArray(extra.reasoningSwipes)
    ? extra.reasoningSwipes.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id: Number(raw.id),
    chatId: Number(coalesceRaw(raw, "chat_id", "chatId")),
    role: fromRaw(raw.role, "assistant") as Message["role"],
    name: fromRaw(raw.name, ""),
    content,
    isHidden: Boolean(coalesceRaw(raw, "is_hidden", "isHidden")),
    swipeId: Number(coalesceRaw(raw, "swipe_id", "swipeId") ?? 0),
    swipes: parseJson<string[]>(raw.swipes ?? "[]", []),
    genStarted: fromRaw(coalesceRaw(raw, "gen_started", "genStarted"), null),
    genFinished: fromRaw(coalesceRaw(raw, "gen_finished", "genFinished"), null),
    extra,
    reasoning: typeof extra.reasoning === "string" ? extra.reasoning : undefined,
    reasoningSwipes: reasoningSwipes.length > 0 ? reasoningSwipes : undefined,
    structuredContent: parseStructuredMessageContent(content, extra),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
  };
}

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
