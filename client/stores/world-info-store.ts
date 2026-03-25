import { create } from "zustand";
import { worldInfoApi, type WorldInfoBook, type WorldInfoEntry } from "@/lib/api/world-info";

interface WorldInfoState {
  books: WorldInfoBook[];
  selectedBookId: number | null;
  entries: WorldInfoEntry[];
  loading: boolean;

  fetchBooks: () => Promise<void>;
  selectBook: (id: number | null) => Promise<void>;
  createBook: (data: { name: string; description?: string }) => Promise<WorldInfoBook>;
  updateBook: (id: number, data: Partial<WorldInfoBook>) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
  createEntry: (bookId: number, data: Partial<WorldInfoEntry>) => Promise<WorldInfoEntry>;
  updateEntry: (entryId: number, data: Partial<WorldInfoEntry>) => Promise<void>;
  deleteEntry: (entryId: number) => Promise<void>;
  importBook: (data: {
    name: string;
    description?: string;
    entries: Array<Record<string, unknown>>;
  }) => Promise<WorldInfoBook>;
}

export const useWorldInfoStore = create<WorldInfoState>()((set, get) => ({
  books: [],
  selectedBookId: null,
  entries: [],
  loading: false,

  fetchBooks: async () => {
    set({ loading: true });
    try {
      const books = await worldInfoApi.getAllBooks();
      set({ books });
    } finally {
      set({ loading: false });
    }
  },

  selectBook: async (id) => {
    set({ selectedBookId: id, entries: [] });
    if (id === null) return;
    set({ loading: true });
    try {
      const result = await worldInfoApi.getBook(id);
      set({ entries: result.entries });
    } finally {
      set({ loading: false });
    }
  },

  createBook: async (data) => {
    const book = await worldInfoApi.createBook(data);
    set((s) => ({ books: [...s.books, book] }));
    return book;
  },

  updateBook: async (id, data) => {
    const updated = await worldInfoApi.updateBook(id, data);
    set((s) => ({ books: s.books.map((b) => (b.id === id ? updated : b)) }));
  },

  deleteBook: async (id) => {
    await worldInfoApi.deleteBook(id);
    set((s) => ({
      books: s.books.filter((b) => b.id !== id),
      selectedBookId: s.selectedBookId === id ? null : s.selectedBookId,
      entries: s.selectedBookId === id ? [] : s.entries,
    }));
  },

  createEntry: async (bookId, data) => {
    const entry = await worldInfoApi.createEntry(bookId, data);
    if (get().selectedBookId === bookId) {
      set((s) => ({ entries: [...s.entries, entry] }));
    }
    return entry;
  },

  updateEntry: async (entryId, data) => {
    const updated = await worldInfoApi.updateEntry(entryId, data);
    set((s) => ({ entries: s.entries.map((e) => (e.id === entryId ? updated : e)) }));
  },

  deleteEntry: async (entryId) => {
    await worldInfoApi.deleteEntry(entryId);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }));
  },

  importBook: async (data) => {
    const book = await worldInfoApi.importBook(data);
    set((s) => ({ books: [...s.books, book] }));
    return book;
  },
}));
