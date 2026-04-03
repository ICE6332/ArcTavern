/**
 * RPC handlers: chat message operations.
 * Covers getChatMessages, getLastMessage, getMessage, editMessage,
 * deleteMessage, addMessage — the core message APIs that JSR scripts need.
 */

import { useChatStore } from "@/stores/chat-store";
import { chatApi } from "@/lib/api/chat";
import type { RpcHandler } from "../rpc-registry";

/** getChatMessages({ range?, role?, limit? }) */
export const getChatMessages: RpcHandler = (params) => {
  const messages = useChatStore.getState().messages;
  let result = messages;

  const role = typeof params.role === "string" ? params.role : undefined;
  if (role) {
    result = result.filter((m) => m.role === role);
  }

  const limit = typeof params.limit === "number" ? params.limit : undefined;
  if (limit && limit > 0) {
    result = result.slice(-limit);
  }

  return result.map((m) => ({
    id: m.id,
    role: m.role,
    name: m.name,
    content: m.content,
    isHidden: m.isHidden,
    swipeId: m.swipeId,
    swipes: m.swipes,
    extra: m.extra,
    createdAt: m.createdAt,
  }));
};

/** getLastMessage({ role? }) */
export const getLastMessage: RpcHandler = (params) => {
  const messages = useChatStore.getState().messages;
  const role = typeof params.role === "string" ? params.role : undefined;
  const filtered = role ? messages.filter((m) => m.role === role) : messages;
  const last = filtered.at(-1);
  if (!last) return null;

  return {
    id: last.id,
    role: last.role,
    name: last.name,
    content: last.content,
    swipeId: last.swipeId,
    swipes: last.swipes,
    extra: last.extra,
  };
};

/** getMessage({ id }) */
export const getMessage: RpcHandler = (params) => {
  const id = typeof params.id === "number" ? params.id : null;
  if (id == null) return null;

  const message = useChatStore.getState().messages.find((m) => m.id === id);
  if (!message) return null;

  return {
    id: message.id,
    role: message.role,
    name: message.name,
    content: message.content,
    isHidden: message.isHidden,
    swipeId: message.swipeId,
    swipes: message.swipes,
    extra: message.extra,
    createdAt: message.createdAt,
  };
};

/** getLastMessageId() */
export const getLastMessageId: RpcHandler = () => {
  const messages = useChatStore.getState().messages;
  return messages.at(-1)?.id ?? null;
};

/** editMessage({ id, content?, extra?, isHidden? }) */
export const editMessage: RpcHandler = async (params) => {
  const id = typeof params.id === "number" ? params.id : null;
  if (id == null) return false;

  const updates: Record<string, unknown> = {};
  if (typeof params.content === "string") updates.content = params.content;
  if (params.extra && typeof params.extra === "object") updates.extra = params.extra;
  if (typeof params.isHidden === "boolean") updates.isHidden = params.isHidden;

  if (Object.keys(updates).length === 0) return false;

  const updated = await chatApi.updateMessage(id, updates);
  useChatStore.setState((state) => ({
    messages: state.messages.map((m) => (m.id === id ? updated : m)),
  }));
  return true;
};

/** deleteMessage({ id }) */
export const deleteMessageHandler: RpcHandler = async (params) => {
  const id = typeof params.id === "number" ? params.id : null;
  if (id == null) return false;

  await chatApi.deleteMessage(id);
  useChatStore.setState((state) => ({
    messages: state.messages.filter((m) => m.id !== id),
  }));
  return true;
};

/** addMessage({ role, content, name? }) */
export const addMessage: RpcHandler = async (params, ctx) => {
  const chatId = ctx.chatId;
  if (chatId == null) return null;

  const role = typeof params.role === "string" ? params.role : "system";
  const content = typeof params.content === "string" ? params.content : "";
  const name = typeof params.name === "string" ? params.name : undefined;

  const message = await chatApi.addMessage(chatId, { role, content, name });
  useChatStore.setState((state) => ({
    messages: [...state.messages, message],
  }));
  return { id: message.id };
};

/** getMessageCount() */
export const getMessageCount: RpcHandler = () => {
  return useChatStore.getState().messages.length;
};
