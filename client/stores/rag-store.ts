import { create } from "zustand";
import { ragApi, type RagSettings } from "@/lib/api";

interface RagState {
  settings: RagSettings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<RagSettings>) => Promise<void>;
  clearChatVectors: (chatId: number) => Promise<void>;
  clearCharacterVectors: (characterId: number) => Promise<void>;
}

export const useRagStore = create<RagState>((set) => ({
  settings: null,
  loading: false,
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await ragApi.getSettings();
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  updateSettings: async (data) => {
    const settings = await ragApi.updateSettings(data);
    set({ settings });
  },
  clearChatVectors: async (chatId) => {
    await ragApi.deleteChatVectors(chatId);
  },
  clearCharacterVectors: async (characterId) => {
    await ragApi.deleteCharacterVectors(characterId);
  },
}));
