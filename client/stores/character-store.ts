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
  updateAvatar: (id: number, file: File) => Promise<void>;
  importCharacter: (file: File) => Promise<Character>;
  duplicateCharacter: (id: number) => Promise<Character>;
  exportCharacter: (id: number, format: 'json' | 'png') => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  characters: [],
  selectedId: null,
  loading: false,
  error: null,

  fetchCharacters: async () => {
    set({ loading: true, error: null });
    try {
      const characters = await characterApi.getAll();
      set({ characters, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch characters';
      set({ error: message, loading: false });
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

  updateAvatar: async (id, file) => {
    const updated = await characterApi.updateAvatar(id, file);
    set((s) => ({
      characters: s.characters.map((c) => (c.id === id ? updated : c)),
    }));
  },

  importCharacter: async (file) => {
    const created = await characterApi.import(file);
    set((s) => ({ characters: [created, ...s.characters], selectedId: created.id }));
    return created;
  },

  duplicateCharacter: async (id) => {
    const duplicated = await characterApi.duplicate(id);
    set((s) => ({ characters: [duplicated, ...s.characters] }));
    return duplicated;
  },

  exportCharacter: async (id, format) => {
    const blob = await characterApi.export(id, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character-${id}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  deleteCharacter: async (id) => {
    await characterApi.delete(id);
    set((s) => ({
      characters: s.characters.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },
}));
