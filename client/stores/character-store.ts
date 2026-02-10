import { create } from 'zustand';
import { characterApi, type Character } from '@/lib/api';

interface CharacterState {
  characters: Character[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;

  fetchCharacters: () => Promise<void>;
  selectCharacter: (id: number | null) => void;
  createCharacter: (data: Partial<Character>) => Promise<Character>;
  updateCharacter: (id: number, data: Partial<Character>) => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  selectedId: null,
  loading: false,
  error: null,

  fetchCharacters: async () => {
    set({ loading: true, error: null });
    try {
      const characters = await characterApi.getAll();
      set({ characters, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  selectCharacter: (id) => set({ selectedId: id }),

  createCharacter: async (data) => {
    const character = await characterApi.create(data);
    set((s) => ({ characters: [...s.characters, character] }));
    return character;
  },

  updateCharacter: async (id, data) => {
    const updated = await characterApi.update(id, data);
    set((s) => ({
      characters: s.characters.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCharacter: async (id) => {
    await characterApi.delete(id);
    set((s) => ({
      characters: s.characters.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },
}));
