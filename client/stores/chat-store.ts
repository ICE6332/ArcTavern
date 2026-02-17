import { create } from "zustand";
import {
  chatApi,
  type Chat,
  type CompletionRequest,
  type GenerationType,
  type Message,
} from "@/lib/api";
import { chatDebug, chatError } from "@/lib/chat-debug";

type GenerationConfig = Omit<CompletionRequest, "messages" | "stream"> & {
  userName?: string;
  maxContext?: number;
};

interface ChatState {
  chats: Chat[];
  currentChatId: number | null;
  messages: Message[];
  isGenerating: boolean;
  streamingContent: string;
  error: string | null;

  fetchChats: (characterId: number) => Promise<void>;
  selectChat: (chatId: number | null) => Promise<void>;
  createChat: (characterId: number, name?: string) => Promise<Chat>;
  deleteChat: (chatId: number) => Promise<void>;
  generate: (
    type: GenerationType,
    config: GenerationConfig,
    message?: string,
  ) => Promise<void>;
  sendMessage: (content: string, config: GenerationConfig) => Promise<void>;
  regenerate: (config: GenerationConfig) => Promise<void>;
  continueMessage: (config: GenerationConfig) => Promise<void>;
  impersonate: (config: GenerationConfig) => Promise<void>;
  stopGeneration: () => Promise<void>;
  swipe: (messageId: number, direction: "left" | "right") => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
}

let abortController: AbortController | null = null;
const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  isGenerating: false,
  streamingContent: "",
  error: null,

  fetchChats: async (characterId) => {
    chatDebug("fetchChats.start", { characterId });
    try {
      const chats = await chatApi.getByCharacter(characterId);
      set({ chats });
      chatDebug("fetchChats.success", { characterId, count: chats.length });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, "Failed to fetch chats") });
      chatError("fetchChats.error", error, { characterId });
    }
  },

  selectChat: async (chatId) => {
    if (chatId === get().currentChatId) {
      chatDebug("selectChat.skip.same", { chatId });
      return;
    }
    chatDebug("selectChat.start", { from: get().currentChatId, to: chatId });
    set({
      currentChatId: chatId,
      messages: [],
      streamingContent: "",
      isGenerating: false,
      error: null,
    });
    if (chatId) {
      try {
        const messages = await chatApi.getMessages(chatId);
        set({ messages });
        chatDebug("selectChat.success", { chatId, messageCount: messages.length });
      } catch (error: unknown) {
        set({ error: getErrorMessage(error, "Failed to load messages") });
        chatError("selectChat.error", error, { chatId });
      }
    }
  },

  createChat: async (characterId, name) => {
    chatDebug("createChat.start", { characterId, name: name ?? "" });
    const chat = await chatApi.create(characterId, name);
    const messages = await chatApi.getMessages(chat.id);
    set((s) => ({
      chats: [chat, ...s.chats],
      currentChatId: chat.id,
      messages,
      error: null,
    }));
    chatDebug("createChat.success", {
      characterId,
      chatId: chat.id,
      messageCount: messages.length,
    });
    return chat;
  },

  deleteChat: async (chatId) => {
    chatDebug("deleteChat.start", { chatId, currentChatId: get().currentChatId });
    await chatApi.delete(chatId);
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== chatId),
      currentChatId: s.currentChatId === chatId ? null : s.currentChatId,
      messages: s.currentChatId === chatId ? [] : s.messages,
    }));
    chatDebug("deleteChat.success", {
      chatId,
      currentChatId: get().currentChatId,
      remaining: get().chats.length,
    });
  },

  generate: async (type, config, message) => {
    const { currentChatId } = get();
    if (!currentChatId) {
      chatDebug("generate.skip.noCurrentChat", { type });
      return;
    }

    const trimmedMessage = message?.trim();
    if (type === "normal" && !trimmedMessage) {
      chatDebug("generate.skip.emptyMessage", { currentChatId });
      return;
    }

    chatDebug("generate.start", {
      type,
      currentChatId,
      provider: config.provider,
      model: config.model,
      messageLength: trimmedMessage?.length ?? 0,
    });

    const optimisticMessages = get().messages;
    if (type === "normal" && trimmedMessage) {
      const optimistic: Message = {
        id: Date.now(),
        chatId: currentChatId,
        role: "user",
        name: "",
        content: trimmedMessage,
        isHidden: false,
        swipeId: 0,
        swipes: [],
        genStarted: null,
        genFinished: null,
        extra: {},
        createdAt: new Date().toISOString(),
      };
      set({ messages: [...optimisticMessages, optimistic] });
      chatDebug("generate.optimisticUserMessage", {
        currentChatId,
        optimisticMessageId: optimistic.id,
        totalMessages: optimisticMessages.length + 1,
      });
    }

    abortController?.abort();
    abortController = new AbortController();

    set({
      isGenerating: true,
      streamingContent: "",
      error: null,
    });

    try {
      const requestPayload = {
        ...config,
        type,
        message: trimmedMessage,
      };
      let requestBytes = 0;
      try {
        requestBytes = new TextEncoder().encode(JSON.stringify(requestPayload)).length;
      } catch {
        requestBytes = 0;
      }
      chatDebug("generate.requestPayload", {
        type,
        currentChatId,
        requestBytes,
        promptOrderCount: Array.isArray((requestPayload as Record<string, unknown>).promptOrder)
          ? ((requestPayload as Record<string, unknown>).promptOrder as unknown[]).length
          : 0,
        customPromptCount: Array.isArray((requestPayload as Record<string, unknown>).customPrompts)
          ? ((requestPayload as Record<string, unknown>).customPrompts as unknown[]).length
          : 0,
      });

      let fullContent = "";
      let chunkCount = 0;
      for await (const chunk of chatApi.generate(
        currentChatId,
        requestPayload,
        abortController.signal,
      )) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }
        if (chunk.content) {
          chunkCount += 1;
          fullContent += chunk.content;
          set({ streamingContent: fullContent });
          if (chunkCount <= 3 || chunkCount % 20 === 0) {
            chatDebug("generate.chunk", {
              currentChatId,
              chunkCount,
              aggregatedLength: fullContent.length,
            });
          }
        }
      }

      const freshMessages = await chatApi
        .getMessages(currentChatId)
        .catch(() => get().messages);
      set({
        messages: freshMessages,
        isGenerating: false,
        streamingContent: "",
      });
      chatDebug("generate.success", {
        type,
        currentChatId,
        finalContentLength: fullContent.length,
        freshMessageCount: freshMessages.length,
      });
    } catch (error: unknown) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (!isAbort) {
        set({ error: getErrorMessage(error, "Generation failed") });
        chatError("generate.error", error, {
          type,
          currentChatId,
        });
      } else {
        chatDebug("generate.aborted", { type, currentChatId });
      }
      const freshMessages = await chatApi
        .getMessages(currentChatId)
        .catch(() => get().messages);
      set({
        messages: freshMessages,
        isGenerating: false,
        streamingContent: "",
      });
      chatDebug("generate.postErrorSync", {
        currentChatId,
        freshMessageCount: freshMessages.length,
      });
    } finally {
      abortController = null;
      chatDebug("generate.finally", {
        type,
        currentChatId,
        isGenerating: get().isGenerating,
      });
    }
  },

  sendMessage: async (content, config) => {
    await get().generate("normal", config, content);
  },

  regenerate: async (config) => {
    await get().generate("regenerate", config);
  },

  continueMessage: async (config) => {
    await get().generate("continue", config);
  },

  impersonate: async (config) => {
    await get().generate("impersonate", config);
  },

  stopGeneration: async () => {
    const chatId = get().currentChatId;
    chatDebug("stopGeneration.start", { chatId });
    abortController?.abort();
    abortController = null;
    if (chatId) {
      await chatApi.stop(chatId).catch(() => undefined);
    }
    set({ isGenerating: false, streamingContent: "" });
    chatDebug("stopGeneration.done", { chatId });
  },

  swipe: async (messageId, direction) => {
    chatDebug("swipe.start", { messageId, direction });
    const updated = await chatApi.swipe(messageId, { direction });
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? updated : m)),
    }));
    chatDebug("swipe.success", {
      messageId,
      swipeId: updated.swipeId,
      swipeCount: updated.swipes.length,
    });
  },

  deleteMessage: async (messageId) => {
    chatDebug("deleteMessage.start", { messageId });
    await chatApi.deleteMessage(messageId);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
    chatDebug("deleteMessage.success", {
      messageId,
      remaining: get().messages.length,
    });
  },
}));
