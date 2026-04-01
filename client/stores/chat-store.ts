import { create } from "zustand";
import { chatApi, type Chat, type Message } from "@/lib/api/chat";
import type { CompletionRequest, GenerationType } from "@/lib/api/types";
import { chatDebug, chatError } from "@/lib/chat-debug";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";
import { getErrorMessage } from "@/lib/utils";

type GenerationConfig = Omit<CompletionRequest, "messages" | "stream"> & {
  userName?: string;
  maxContext?: number;
  worldInfoBookIds?: number[];
};

interface ChatState {
  chats: Chat[];
  currentChatId: number | null;
  messages: Message[];
  isGenerating: boolean;
  generationType: GenerationType | null;
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: PartialStructuredResponse | null;
  error: string | null;

  fetchChats: (characterId: number) => Promise<void>;
  selectChat: (chatId: number | null) => Promise<void>;
  createChat: (characterId: number, name?: string) => Promise<Chat>;
  deleteChat: (chatId: number) => Promise<void>;
  updateChatName: (chatId: number, name: string) => Promise<void>;
  generateTitle: (
    chatId: number,
    config: { provider: string; model: string; reverseProxy?: string; customApiFormat?: string },
  ) => Promise<string | null>;
  refreshCurrentChat: () => Promise<void>;
  generate: (type: GenerationType, config: GenerationConfig, message?: string) => Promise<void>;
  sendMessage: (content: string, config: GenerationConfig) => Promise<void>;
  regenerate: (config: GenerationConfig) => Promise<void>;
  generateSwipe: (config: GenerationConfig) => Promise<void>;
  continueMessage: (config: GenerationConfig) => Promise<void>;
  impersonate: (config: GenerationConfig) => Promise<void>;
  stopGeneration: () => Promise<void>;
  swipe: (messageId: number, direction: "left" | "right") => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
}

type StreamingSnapshot = {
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: PartialStructuredResponse | null;
};

const emptyStreamingSnapshot = (): StreamingSnapshot => ({
  streamingContent: "",
  streamingReasoning: "",
  streamingStructured: null,
});

let abortController: AbortController | null = null;
const streamingBuffer: StreamingSnapshot = emptyStreamingSnapshot();

// Chunk throttle — keeps at most one pending snapshot and drains every CHUNK_INTERVAL_MS
let pendingChunk: Partial<StreamingSnapshot> | null = null;
let drainHandle: ReturnType<typeof setTimeout> | null = null;
const CHUNK_INTERVAL_MS = 25;

function clearStreamingBuffer() {
  streamingBuffer.streamingContent = "";
  streamingBuffer.streamingReasoning = "";
  streamingBuffer.streamingStructured = null;
}

function clearChunkQueue() {
  pendingChunk = null;
  if (drainHandle !== null) {
    clearTimeout(drainHandle);
    drainHandle = null;
  }
}

function applyChunkToBuffer(data: Partial<StreamingSnapshot>) {
  if (data.streamingContent !== undefined) {
    streamingBuffer.streamingContent = data.streamingContent;
  }
  if (data.streamingReasoning !== undefined) {
    streamingBuffer.streamingReasoning = data.streamingReasoning;
  }
  if (data.streamingStructured !== undefined) {
    streamingBuffer.streamingStructured = data.streamingStructured;
  }
}

function drainChunkQueue() {
  drainHandle = null;
  if (!pendingChunk) return;
  applyChunkToBuffer(pendingChunk);
  pendingChunk = null;
  useChatStore.setState({ ...streamingBuffer });
}

function enqueueChunk(data: Partial<StreamingSnapshot>) {
  // Merge into pending snapshot — latest value wins, O(1) memory
  if (pendingChunk) {
    Object.assign(pendingChunk, data);
  } else {
    pendingChunk = { ...data };
  }
  if (drainHandle === null) {
    drainHandle = setTimeout(drainChunkQueue, CHUNK_INTERVAL_MS);
  }
}

function flushAllChunks() {
  if (drainHandle !== null) {
    clearTimeout(drainHandle);
    drainHandle = null;
  }
  if (pendingChunk) {
    applyChunkToBuffer(pendingChunk);
    pendingChunk = null;
  }
  // Synchronous commit — guaranteed to land before any subsequent cleanup
  useChatStore.setState({ ...streamingBuffer });
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  isGenerating: false,
  generationType: null,
  ...emptyStreamingSnapshot(),
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

    const previousChatId = get().currentChatId;
    chatDebug("selectChat.start", { from: previousChatId, to: chatId });

    if (abortController) {
      abortController.abort();
      abortController = null;
      if (previousChatId) {
        chatApi.stop(previousChatId).catch(() => undefined);
      }
    }

    clearChunkQueue();
    clearStreamingBuffer();
    set({
      currentChatId: chatId,
      messages: [],
      isGenerating: false,
      error: null,
      ...emptyStreamingSnapshot(),
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

  updateChatName: async (chatId, name) => {
    const updated = await chatApi.updateChat(chatId, { name });
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? updated : c)),
    }));
  },

  generateTitle: async (chatId, config) => {
    try {
      const { title } = await chatApi.generateTitle(chatId, config);
      set((s) => ({
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, name: title } : c)),
      }));
      return title;
    } catch {
      return null;
    }
  },

  refreshCurrentChat: async () => {
    const chatId = get().currentChatId;
    if (!chatId) return;

    try {
      const messages = await chatApi.getMessages(chatId);
      set({ messages, error: null });
      chatDebug("refreshCurrentChat.success", {
        chatId,
        messageCount: messages.length,
      });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, "Failed to refresh messages") });
      chatError("refreshCurrentChat.error", error, { chatId });
    }
  },

  generate: async (type, config, message) => {
    const { currentChatId } = get();
    if (!currentChatId) {
      chatDebug("generate.skip.noCurrentChat", { type });
      return;
    }
    const generationChatId = currentChatId;

    const trimmedMessage = message?.trim();
    if (type === "normal" && !trimmedMessage) {
      chatDebug("generate.skip.emptyMessage", { currentChatId });
      return;
    }

    chatDebug("generate.start", {
      type,
      currentChatId: generationChatId,
      provider: config.provider,
      model: config.model,
      messageLength: trimmedMessage?.length ?? 0,
    });

    const optimisticMessages = get().messages;
    if (type === "normal" && trimmedMessage) {
      const optimistic: Message = {
        id: Date.now(),
        chatId: generationChatId,
        role: "user",
        name: "",
        content: trimmedMessage,
        isHidden: false,
        swipeId: 0,
        swipes: [],
        genStarted: null,
        genFinished: null,
        extra: {},
        structuredContent: null,
        createdAt: new Date().toISOString(),
      };
      set({ messages: [...optimisticMessages, optimistic] });
      chatDebug("generate.optimisticUserMessage", {
        currentChatId: generationChatId,
        optimisticMessageId: optimistic.id,
        totalMessages: optimisticMessages.length + 1,
      });
    }

    abortController?.abort();
    abortController = new AbortController();
    clearChunkQueue();

    clearStreamingBuffer();

    set({
      isGenerating: true,
      generationType: type,
      error: null,
      ...emptyStreamingSnapshot(),
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
        currentChatId: generationChatId,
        requestBytes,
        promptOrderCount: Array.isArray((requestPayload as Record<string, unknown>).promptOrder)
          ? ((requestPayload as Record<string, unknown>).promptOrder as unknown[]).length
          : 0,
        customPromptCount: Array.isArray((requestPayload as Record<string, unknown>).customPrompts)
          ? ((requestPayload as Record<string, unknown>).customPrompts as unknown[]).length
          : 0,
      });

      let fullContent = "";
      let fullReasoning = "";
      let chunkCount = 0;
      for await (const chunk of chatApi.generate(
        generationChatId,
        requestPayload,
        abortController.signal,
      )) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.content) {
          chunkCount += 1;
          fullContent += chunk.content;
          enqueueChunk({ streamingContent: fullContent });
          if (chunkCount <= 3 || chunkCount % 20 === 0) {
            chatDebug("generate.chunk", {
              generationChatId,
              chunkCount,
              aggregatedLength: fullContent.length,
            });
          }
        }

        if (chunk.reasoning) {
          fullReasoning += chunk.reasoning;
          enqueueChunk({ streamingReasoning: fullReasoning });
        }

        if (chunk.structured) {
          enqueueChunk({
            streamingStructured: chunk.structured as PartialStructuredResponse,
          });
        }
      }

      const localSignal = abortController?.signal;
      const freshMessages = await chatApi.getMessages(generationChatId).catch(() => get().messages);
      // Guard: if aborted during await, a new generate owns the global state — bail out
      if (localSignal?.aborted) return;
      flushAllChunks();

      clearStreamingBuffer();
      if (get().currentChatId !== generationChatId) {
        chatDebug("generate.skipApply.chatChanged", {
          generationChatId,
          currentChatId: get().currentChatId,
        });
        return;
      }
      set({
        messages: freshMessages,
        isGenerating: false,
        generationType: null,
        ...emptyStreamingSnapshot(),
      });
      chatDebug("generate.success", {
        type,
        currentChatId: generationChatId,
        finalContentLength: fullContent.length,
        freshMessageCount: freshMessages.length,
      });
    } catch (error: unknown) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (!isAbort) {
        set({ error: getErrorMessage(error, "Generation failed") });
        chatError("generate.error", error, {
          type,
          currentChatId: generationChatId,
        });
      } else {
        chatDebug("generate.aborted", { type, currentChatId: generationChatId });
      }
      const freshMessages = await chatApi.getMessages(generationChatId).catch(() => get().messages);
      // Guard: if a new generate started while we awaited, don't touch its state
      if (get().currentChatId !== generationChatId) {
        chatDebug("generate.skipErrorApply.chatChanged", {
          generationChatId,
          currentChatId: get().currentChatId,
        });
        return;
      }
      flushAllChunks();

      clearStreamingBuffer();
      set({
        messages: freshMessages,
        isGenerating: false,
        generationType: null,
        ...emptyStreamingSnapshot(),
      });
      chatDebug("generate.postErrorSync", {
        currentChatId: generationChatId,
        freshMessageCount: freshMessages.length,
      });
    } finally {
      abortController = null;
      chatDebug("generate.finally", {
        type,
        currentChatId: generationChatId,
        isGenerating: get().isGenerating,
      });
    }
  },

  sendMessage: async (content, config) => {
    await get().generate("normal", config, content);
  },

  regenerate: async (config) => {
    const hasAssistant = get().messages.some((m) => m.role === "assistant");
    if (!hasAssistant) {
      set({ error: "No assistant message to regenerate" });
      return;
    }
    await get().generate("regenerate", config);
  },

  generateSwipe: async (config) => {
    const hasAssistant = get().messages.some((m) => m.role === "assistant");
    if (!hasAssistant) {
      set({ error: "No assistant message to generate swipe for" });
      return;
    }
    await get().generate("swipe", config);
  },

  continueMessage: async (config) => {
    const hasAssistant = get().messages.some((m) => m.role === "assistant");
    if (!hasAssistant) {
      set({ error: "No assistant message to continue" });
      return;
    }
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
    clearChunkQueue();

    clearStreamingBuffer();
    if (chatId) {
      await chatApi.stop(chatId).catch(() => undefined);
    }
    set({
      isGenerating: false,
      generationType: null,
      ...emptyStreamingSnapshot(),
    });
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
