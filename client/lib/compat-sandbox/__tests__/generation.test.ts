import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RpcContext } from "../rpc-registry";

const { generationConfig, chatState } = vi.hoisted(() => ({
  generationConfig: { provider: "openai", model: "gpt-5.2" },
  chatState: {
    isGenerating: false,
    sendMessage: vi.fn(),
    continueMessage: vi.fn(),
    impersonate: vi.fn(),
    generateSwipe: vi.fn(),
    regenerate: vi.fn(),
    stopGeneration: vi.fn(),
    generationType: null,
    streamingContent: "",
    streamingReasoning: "",
  },
}));

vi.mock("@/stores/chat-store", () => ({
  useChatStore: {
    getState: () => chatState,
  },
}));

vi.mock("@/stores/character-store", () => ({
  useCharacterStore: {
    getState: () => ({
      selectedId: 1,
      characters: [{ id: 1, worldInfoBookId: 7 }],
    }),
  },
}));

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: {
    getState: () => ({
      provider: "openai",
      model: "gpt-5.2",
    }),
  },
}));

vi.mock("@/stores/prompt-manager-store", () => ({
  usePromptManagerStore: {
    getState: () => ({
      components: [],
    }),
  },
}));

vi.mock("@/stores/world-info-store", () => ({
  useWorldInfoStore: {
    getState: () => ({
      activeBookIds: [],
    }),
  },
}));

vi.mock("@/hooks/use-generation-config", () => ({
  buildGenerationConfig: vi.fn(() => ({
    generationConfig,
    promptOrder: [],
    customPrompts: [],
  })),
}));

import { generate } from "../rpc-handlers/generation";

const ctx: RpcContext = {
  chatId: 1,
  characterId: 1,
  extras: {},
};

describe("compat sandbox generation RPC", () => {
  beforeEach(() => {
    chatState.isGenerating = false;
    chatState.sendMessage.mockReset();
    chatState.continueMessage.mockReset();
    chatState.impersonate.mockReset();
    chatState.generateSwipe.mockReset();
    chatState.regenerate.mockReset();
    chatState.stopGeneration.mockReset();
  });

  it('runs a normal generation through sendMessage instead of returning an intent', async () => {
    chatState.sendMessage.mockResolvedValue(undefined);

    await expect(generate({ type: "normal", message: "hello" }, ctx)).resolves.toBe(true);

    expect(chatState.sendMessage).toHaveBeenCalledWith("hello", generationConfig);
  });

  it("runs a non-normal generation through the matching store action", async () => {
    chatState.continueMessage.mockResolvedValue(undefined);

    await expect(generate({ type: "continue" }, ctx)).resolves.toBe(true);

    expect(chatState.continueMessage).toHaveBeenCalledWith(generationConfig);
  });

  it("rejects when a generation is already in progress", async () => {
    chatState.isGenerating = true;

    await expect(generate({ type: "normal", message: "hello" }, ctx)).rejects.toThrow(
      "Generation already in progress",
    );
  });
});
