import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Character } from "@/lib/api/character";

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

vi.mock("@/lib/api/character", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/character")>("@/lib/api/character");

  return {
    ...actual,
    characterApi: characterApiMock,
  };
});

import { useCharacterStore } from "../character-store";

function createCharacterFixture(id: number, name: string): Character {
  return {
    id,
    name,
    avatar: null,
    description: "",
    personality: "",
    firstMes: "",
    mesExample: "",
    scenario: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    alternateGreetings: [],
    creator: "",
    creatorNotes: "",
    characterVersion: "",
    tags: [],
    spec: "chara_card_v2",
    specVersion: "2.0",
    extensions: {},
    characterBook: null,
    worldInfoBookId: null,
    createdAt: "",
    updatedAt: "",
  };
}

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
      createCharacterFixture(1, "Alice"),
      createCharacterFixture(2, "Bob"),
    ]);

    await useCharacterStore.getState().fetchCharacters();

    expect(useCharacterStore.getState().characters).toEqual([
      createCharacterFixture(1, "Alice"),
      createCharacterFixture(2, "Bob"),
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
      characters: [createCharacterFixture(7, "Hero")],
      selectedId: 7,
    });
    characterApiMock.delete.mockResolvedValue({ id: 7 });

    await useCharacterStore.getState().deleteCharacter(7);

    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(useCharacterStore.getState().selectedId).toBeNull();
  });
});
