import { create } from 'zustand';
import { chatApi, aiApi, type Chat, type Message, type CompletionRequest } from '@/lib/api';

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
  sendMessage: (content: string, config: CompletionRequest) => Promise<void>;
  stopGeneration: () => void;
  deleteMessage: (messageId: number) => Promise<void>;
}

// eslint-disable-next-line prefer-const
let abortController = null as AbortController | null;

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: [],
  isGenerating: false,
  streamingContent: '',
  error: null,

  fetchChats: async (characterId) => {
    try {
      const chats = await chatApi.getByCharacter(characterId);
      set({ chats });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  selectChat: async (chatId) => {
    set({ currentChatId: chatId, messages: [], streamingContent: '' });
    if (chatId) {
      try {
        const messages = await chatApi.getMessages(chatId);
        set({ messages });
      } catch (e: any) {
        set({ error: e.message });
      }
    }
  },

  createChat: async (characterId, name) => {
    const chat = await chatApi.create(characterId, name);
    set((s) => ({ chats: [chat, ...s.chats], currentChatId: chat.id, messages: [] }));
    return chat;
  },

  deleteChat: async (chatId) => {
    await chatApi.delete(chatId);
    set((s) => ({
      chats: s.chats.filter((c) => c.id !== chatId),
      currentChatId: s.currentChatId === chatId ? null : s.currentChatId,
      messages: s.currentChatId === chatId ? [] : s.messages,
    }));
  },

  sendMessage: async (content, config) => {
    const { currentChatId, messages } = get();
    if (!currentChatId) return;

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      chatId: currentChatId,
      role: 'user',
      name: '',
      content,
      isHidden: false,
      swipeId: 0,
      swipes: '[]',
      extra: '{}',
      createdAt: new Date().toISOString(),
    };
    set({ messages: [...messages, tempUserMsg], isGenerating: true, streamingContent: '', error: null });

    try {
      let fullContent = '';
      for await (const chunk of aiApi.streamChat({
        ...config,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content, name: m.name })),
          { role: 'user', content },
        ],
        chatId: currentChatId,
        saveToDB: true,
        stream: true,
      })) {
        fullContent += chunk;
        set({ streamingContent: fullContent });
      }

      // Refresh messages from server to get proper IDs
      const freshMessages = await chatApi.getMessages(currentChatId);
      set({ messages: freshMessages, isGenerating: false, streamingContent: '' });
    } catch (e: any) {
      set({ error: e.message, isGenerating: false, streamingContent: '' });
    }
  },

  stopGeneration: () => {
    abortController?.abort();
    set({ isGenerating: false });
  },

  deleteMessage: async (messageId) => {
    await chatApi.deleteMessage(messageId);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
  },
}));
