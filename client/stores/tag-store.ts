import { create } from "zustand";
import { tagApi, type Tag } from "@/lib/api";

interface TagState {
  tags: Tag[];
  loading: boolean;
  // Filter state: map of tagId -> 'include' | 'exclude' | null
  filterState: Record<string, "include" | "exclude" | null>;

  fetchTags: () => Promise<void>;
  createTag: (data: { name: string; color?: string; color2?: string }) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  assignTag: (entityType: string, entityId: string, tagId: string) => Promise<void>;
  unassignTag: (entityType: string, entityId: string, tagId: string) => Promise<void>;
  toggleFilter: (tagId: string) => void;
  clearFilters: () => void;
}

export const useTagStore = create<TagState>()((set) => ({
  tags: [],
  loading: false,
  filterState: {},

  fetchTags: async () => {
    set({ loading: true });
    try {
      const tags = await tagApi.getAll();
      set({ tags });
    } finally {
      set({ loading: false });
    }
  },

  createTag: async (data) => {
    const tag = await tagApi.create(data);
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const updated = await tagApi.update(id, data);
    set((s) => ({ tags: s.tags.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTag: async (id) => {
    await tagApi.delete(id);
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      filterState: { ...s.filterState, [id]: null },
    }));
  },

  assignTag: async (entityType, entityId, tagId) => {
    await tagApi.assign(entityType, entityId, tagId);
  },

  unassignTag: async (entityType, entityId, tagId) => {
    await tagApi.unassign(entityType, entityId, tagId);
  },

  toggleFilter: (tagId) => {
    set((s) => {
      const current = s.filterState[tagId] ?? null;
      const next = current === null ? "include" : current === "include" ? "exclude" : null;
      return { filterState: { ...s.filterState, [tagId]: next } };
    });
  },

  clearFilters: () => set({ filterState: {} }),
}));
