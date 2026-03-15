import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { characterApiMock } = vi.hoisted(() => ({
  characterApiMock: {
    create: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    export: vi.fn(),
    getAll: vi.fn(),
    import: vi.fn(),
    update: vi.fn(),
    updateAvatar: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    characterApi: characterApiMock,
  };
});

import { useCharacterStore } from "./character-store";

describe("useCharacterStore", () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [],
      error: null,
      loading: false,
      selectedId: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads characters into state", async () => {
    characterApiMock.getAll.mockResolvedValue([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    await useCharacterStore.getState().fetchCharacters();

    expect(useCharacterStore.getState().characters).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    expect(useCharacterStore.getState().loading).toBe(false);
    expect(useCharacterStore.getState().error).toBeNull();
  });

  it("captures fetch errors", async () => {
    characterApiMock.getAll.mockRejectedValue(new Error("network down"));

    await useCharacterStore.getState().fetchCharacters();

    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(useCharacterStore.getState().error).toBe("network down");
    expect(useCharacterStore.getState().loading).toBe(false);
  });

  it("clears the selection when deleting the active character", async () => {
    useCharacterStore.setState({
      characters: [{ id: 7, name: "Hero" }],
      selectedId: 7,
    });
    characterApiMock.delete.mockResolvedValue({ id: 7 });

    await useCharacterStore.getState().deleteCharacter(7);

    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(useCharacterStore.getState().selectedId).toBeNull();
  });
});
