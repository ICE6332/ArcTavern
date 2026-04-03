/**
 * RPC handlers: context queries (getContext, getVariables, requestWriteDone).
 */

import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useVariableStore } from "@/stores/variable-store";
import { ST_COMPAT_VARS_KEY } from "@/lib/compat/js-runtime";
import { type RpcHandler } from "../rpc-registry";

function getCompatVarRow(messageId: number | undefined, swipeId: number): Record<string, unknown> {
  if (!messageId) return {};

  const message = useChatStore.getState().messages.find((item) => item.id === messageId);
  const raw = message?.extra?.[ST_COMPAT_VARS_KEY];
  if (!Array.isArray(raw)) return {};

  const row = raw[swipeId];
  return row && typeof row === "object" ? { ...(row as Record<string, unknown>) } : {};
}

export const getContext: RpcHandler = (_params, ctx) => {
  const charStore = useCharacterStore.getState();
  const chatStore = useChatStore.getState();
  const variableStore = useVariableStore.getState();
  const character = charStore.characters.find((c) => c.id === ctx.characterId);

  if (ctx.messageId !== undefined) {
    const messages = chatStore.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }));
    return {
      compatData: ctx.extras.compatData ?? {},
      globalVariables: variableStore.globalVariables,
      chatVariables: variableStore.chatVariables,
      compatVariables: getCompatVarRow(ctx.messageId, ctx.swipeId ?? 0),
      character: {
        id: character?.id ?? null,
        name: character?.name ?? "",
        avatar: character?.avatar ?? "",
      },
      message: {
        id: ctx.messageId ?? null,
        swipeId: ctx.swipeId ?? 0,
        extra: chatStore.messages.find((item) => item.id === ctx.messageId)?.extra ?? {},
      },
      messages,
    };
  }

  return {
    chatId: ctx.chatId,
    characterId: ctx.characterId,
    characterName: character?.name ?? "",
    messageCount: chatStore.messages.length,
  };
};

export const getVariables: RpcHandler = () => {
  const { globalVariables, chatVariables } = useVariableStore.getState();
  return { global: globalVariables, chat: chatVariables };
};

export const requestWriteDone: RpcHandler = (_params, ctx) => {
  if (ctx.extras.compatData) {
    const data = ctx.extras.compatData as Record<string, unknown>;
    return { statWithoutMeta: data.statWithoutMeta };
  }
  const { globalVariables, chatVariables } = useVariableStore.getState();
  return { global: globalVariables, chat: chatVariables };
};

export const getVariable: RpcHandler = (params, ctx) => {
  const name = typeof params.name === "string" ? params.name : "";
  const scope = typeof params.scope === "string" ? params.scope : "auto";
  if (!name) return undefined;

  const variableStore = useVariableStore.getState();
  const compatRow = getCompatVarRow(ctx.messageId, ctx.swipeId ?? 0);

  if (scope === "compat") return compatRow[name];
  if (scope === "chat") return variableStore.chatVariables[name];
  if (scope === "global") return variableStore.globalVariables[name];
  return (
    compatRow[name] ?? variableStore.chatVariables[name] ?? variableStore.globalVariables[name]
  );
};

export const setVariable: RpcHandler = async (params, ctx) => {
  const name = typeof params.name === "string" ? params.name : "";
  const scope = typeof params.scope === "string" ? params.scope : "compat";
  if (!name) return false;

  const variableStore = useVariableStore.getState();
  const value = params.value;

  if (scope === "global") {
    variableStore.setGlobalVariable(name, String(value ?? ""));
    return true;
  }
  if (scope === "chat") {
    variableStore.setChatVariable(name, String(value ?? ""));
    return true;
  }

  // compat scope: write to message extra
  const messageId = ctx.messageId;
  const swipeId = ctx.swipeId ?? 0;
  if (!messageId) return false;

  const { chatApi } = await import("@/lib/api/chat");
  const message = useChatStore.getState().messages.find((item) => item.id === messageId);
  if (!message) return false;

  const extra = { ...message.extra };
  const raw = extra[ST_COMPAT_VARS_KEY];
  const rows = Array.isArray(raw) ? [...raw] : [];
  while (rows.length <= swipeId) rows.push({});

  const row =
    rows[swipeId] && typeof rows[swipeId] === "object"
      ? { ...(rows[swipeId] as Record<string, unknown>) }
      : {};
  row[name] = value;
  rows[swipeId] = row;
  extra[ST_COMPAT_VARS_KEY] = rows;

  const updated = await chatApi.updateMessage(messageId, { extra });
  useChatStore.setState((state) => ({
    messages: state.messages.map((item) => (item.id === messageId ? updated : item)),
  }));
  return true;
};
