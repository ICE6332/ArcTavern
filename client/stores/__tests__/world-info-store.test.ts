import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldInfoBook, WorldInfoEntry } from "@/lib/api/world-info";

const { worldInfoApiMock } = vi.hoisted(() => ({
  worldInfoApiMock: {
    getAllBooks: vi.fn(),
    getBook: vi.fn(),
    createBook: vi.fn(),
    updateBook: vi.fn(),
    deleteBook: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    importBook: vi.fn(),
  },
}));

vi.mock("@/lib/api/world-info", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/world-info")>("@/lib/api/world-info");

  return {
    ...actual,
    worldInfoApi: worldInfoApiMock,
  };
});

import { useWorldInfoStore } from "../world-info-store";

function createBookFixture(id: number, name: string): WorldInfoBook {
  return {
    id,
    name,
    description: "",
    createdAt: "",
    updatedAt: "",
  };
}

function createEntryFixture(
  id: number,
  bookId: number,
  patch: Partial<WorldInfoEntry> = {},
): WorldInfoEntry {
  return {
    id,
    bookId,
    uid: id,
    keys: ["keyword"],
    secondaryKeys: [],
    content: "entry",
    comment: "entry",
    enabled: true,
    insertionOrder: 100,
    caseSensitive: false,
    priority: 10,
    position: "before_char",
    constant: false,
    selective: false,
    selectLogic: 0,
    order: 100,
    excludeRecursion: false,
    preventRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    groupName: "",
    groupOverride: false,
    groupWeight: 100,
    scanDepth: 0,
    matchWholeWords: false,
    useGroupScoring: false,
    automationId: "",
    role: 0,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    useRegex: false,
    vectorized: false,
    contentHash: "",
    ...patch,
  };
}

describe("useWorldInfoStore", () => {
  beforeEach(() => {
    useWorldInfoStore.setState({
      books: [],
      selectedBookId: null,
      entries: [],
      loading: false,
      activeBookIds: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads books and selected book entries", async () => {
    const books = [createBookFixture(1, "Lore"), createBookFixture(2, "Codex")];
    const entries = [createEntryFixture(5, 1)];
    worldInfoApiMock.getAllBooks.mockResolvedValue(books);
    worldInfoApiMock.getBook.mockResolvedValue({
      ...books[0],
      entries,
    });

    await useWorldInfoStore.getState().fetchBooks();
    await useWorldInfoStore.getState().selectBook(1);

    const state = useWorldInfoStore.getState();
    expect(state.books).toEqual(books);
    expect(state.selectedBookId).toBe(1);
    expect(state.entries).toEqual(entries);
    expect(state.loading).toBe(false);
  });

  it("creates, updates, deletes entries, and toggles active books", async () => {
    const initialEntry = createEntryFixture(10, 2, { comment: "old" });
    const createdEntry = createEntryFixture(11, 2, { comment: "new" });
    const updatedEntry = createEntryFixture(11, 2, { comment: "updated" });
    worldInfoApiMock.createEntry.mockResolvedValue(createdEntry);
    worldInfoApiMock.updateEntry.mockResolvedValue(updatedEntry);
    worldInfoApiMock.deleteEntry.mockResolvedValue(updatedEntry);

    useWorldInfoStore.setState({
      books: [createBookFixture(2, "Rules")],
      selectedBookId: 2,
      entries: [initialEntry],
      activeBookIds: [],
      loading: false,
    });

    const store = useWorldInfoStore.getState();
    const entry = await store.createEntry(2, { comment: "new" });
    expect(entry).toEqual(createdEntry);
    expect(useWorldInfoStore.getState().entries).toEqual([initialEntry, createdEntry]);

    await useWorldInfoStore.getState().updateEntry(11, { comment: "updated" });
    expect(useWorldInfoStore.getState().entries).toEqual([initialEntry, updatedEntry]);

    useWorldInfoStore.getState().toggleBookActive(2);
    expect(useWorldInfoStore.getState().activeBookIds).toEqual([2]);

    await useWorldInfoStore.getState().deleteEntry(11);
    expect(useWorldInfoStore.getState().entries).toEqual([initialEntry]);

    useWorldInfoStore.getState().toggleBookActive(2);
    expect(useWorldInfoStore.getState().activeBookIds).toEqual([]);
  });
});
