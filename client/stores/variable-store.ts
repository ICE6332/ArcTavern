import { create } from "zustand";
import { settingsApi } from "@/lib/api";

interface VariableState {
  /** Global variables (persistent across chats) */
  globalVariables: Record<string, string>;
  /** Chat-local variables for the current chat */
  chatVariables: Record<string, string>;
  /** Current chat ID for local variable scoping */
  currentChatId: number | null;

  // Actions
  loadGlobalVariables: () => Promise<void>;
  loadChatVariables: (chatId: number) => Promise<void>;
  setGlobalVariable: (name: string, value: string) => void;
  setChatVariable: (name: string, value: string) => void;
  deleteGlobalVariable: (name: string) => void;
  deleteChatVariable: (name: string) => void;
  syncGlobalVariables: () => Promise<void>;
  syncChatVariables: () => Promise<void>;
}

const GLOBAL_VARS_KEY = "slash:globalvars";
const chatVarsKey = (chatId: number) => `slash:chatvars:${chatId}`;

export const useVariableStore = create<VariableState>()((set, get) => ({
  globalVariables: {},
  chatVariables: {},
  currentChatId: null,

  loadGlobalVariables: async () => {
    try {
      const data = await settingsApi.get(GLOBAL_VARS_KEY);
      if (data && typeof data === "object") {
        set({ globalVariables: data as Record<string, string> });
      }
    } catch {
      // No global variables stored yet
    }
  },

  loadChatVariables: async (chatId: number) => {
    // Save current chat variables before switching
    const { currentChatId } = get();
    if (currentChatId !== null && currentChatId !== chatId) {
      await get().syncChatVariables();
    }

    set({ currentChatId: chatId });

    try {
      const data = await settingsApi.get(chatVarsKey(chatId));
      if (data && typeof data === "object") {
        set({ chatVariables: data as Record<string, string> });
      } else {
        set({ chatVariables: {} });
      }
    } catch {
      set({ chatVariables: {} });
    }
  },

  setGlobalVariable: (name: string, value: string) => {
    set((state) => ({
      globalVariables: { ...state.globalVariables, [name]: value },
    }));
    // Debounced sync happens via the caller or periodic sync
    void get().syncGlobalVariables();
  },

  setChatVariable: (name: string, value: string) => {
    set((state) => ({
      chatVariables: { ...state.chatVariables, [name]: value },
    }));
    void get().syncChatVariables();
  },

  deleteGlobalVariable: (name: string) => {
    set((state) => {
      const { [name]: _, ...rest } = state.globalVariables;
      return { globalVariables: rest };
    });
    void get().syncGlobalVariables();
  },

  deleteChatVariable: (name: string) => {
    set((state) => {
      const { [name]: _, ...rest } = state.chatVariables;
      return { chatVariables: rest };
    });
    void get().syncChatVariables();
  },

  syncGlobalVariables: async () => {
    try {
      await settingsApi.set(GLOBAL_VARS_KEY, get().globalVariables);
    } catch (err) {
      console.error("Failed to sync global variables:", err);
    }
  },

  syncChatVariables: async () => {
    const { currentChatId, chatVariables } = get();
    if (currentChatId === null) return;
    try {
      await settingsApi.set(chatVarsKey(currentChatId), chatVariables);
    } catch (err) {
      console.error("Failed to sync chat variables:", err);
    }
  },
}));
