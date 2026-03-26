import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Preset } from "@/lib/api/preset";

const loadFromPresetMock = vi.fn();
const updateCustomContentMock = vi.fn();
const connectionStateMock = {
  setTemperature: vi.fn(),
  setMaxTokens: vi.fn(),
  setTopP: vi.fn(),
  setTopK: vi.fn(),
  setFrequencyPenalty: vi.fn(),
  setPresencePenalty: vi.fn(),
  setTopA: vi.fn(),
  setMinP: vi.fn(),
  setRepetitionPenalty: vi.fn(),
  setMaxContext: vi.fn(),
  setStreamEnabled: vi.fn(),
  setSeed: vi.fn(),
  setAssistantPrefill: vi.fn(),
  setContinuePrefill: vi.fn(),
  setContinuePostfix: vi.fn(),
  setNamesBehavior: vi.fn(),
  setSquashSystemMessages: vi.fn(),
  setReverseProxy: vi.fn(),
};

const { presetApiMock } = vi.hoisted(() => ({
  presetApiMock: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    import: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/lib/api/preset", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/preset")>("@/lib/api/preset");

  return {
    ...actual,
    presetApi: presetApiMock,
  };
});

vi.mock("./connection-store", async () => {
  const actual = await vi.importActual<typeof import("./connection-store")>("./connection-store");

  return {
    ...actual,
    useConnectionStore: {
      ...actual.useConnectionStore,
      getState: () => connectionStateMock,
    },
  };
});

vi.mock("./prompt-manager-store", async () => {
  const actual =
    await vi.importActual<typeof import("./prompt-manager-store")>("./prompt-manager-store");

  return {
    ...actual,
    usePromptManagerStore: {
      ...actual.usePromptManagerStore,
      getState: () => ({
        loadFromPreset: loadFromPresetMock,
        updateCustomContent: updateCustomContentMock,
        exportToPresetFormat: vi.fn(),
      }),
    },
  };
});

import { usePresetStore } from "./preset-store";

function createPresetFixture(apiType: string, data: string): Preset {
  return {
    id: 1,
    name: "Preset",
    apiType,
    data,
    isDefault: false,
    sourceHash: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("usePresetStore", () => {
  beforeEach(() => {
    usePresetStore.setState({
      presets: {},
      activePresetId: {},
    });
    for (const fn of Object.values(connectionStateMock)) {
      fn.mockReset();
    }
    loadFromPresetMock.mockReset();
    updateCustomContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies openai presets to connection and prompt stores", () => {
    const preset = createPresetFixture(
      "openai",
      JSON.stringify({
        temperature: 0.95,
        openai_max_tokens: 2048,
        top_p: 0.9,
        top_k: 40,
        frequency_penalty: 0.2,
        presence_penalty: 0.3,
        top_a: 0.1,
        min_p: 0.2,
        repetition_penalty: 1.2,
        openai_max_context: 8192,
        stream_openai: false,
        seed: 42,
        assistant_prefill: "prefill",
        continue_prefill: true,
        continue_postfix: "postfix",
        names_behavior: 1,
        squash_system_messages: true,
        reverse_proxy: "https://proxy.example",
        prompts: [{ identifier: "main", name: "Main", content: "Hello" }],
        prompt_order: [{ character_id: 100000, order: [{ identifier: "main", enabled: true }] }],
      }),
    );

    usePresetStore.getState().applyPreset(preset);

    expect(connectionStateMock.setTemperature).toHaveBeenCalledWith(0.95);
    expect(connectionStateMock.setMaxTokens).toHaveBeenCalledWith(2048);
    expect(connectionStateMock.setTopP).toHaveBeenCalledWith(0.9);
    expect(connectionStateMock.setTopK).toHaveBeenCalledWith(40);
    expect(connectionStateMock.setFrequencyPenalty).toHaveBeenCalledWith(0.2);
    expect(connectionStateMock.setPresencePenalty).toHaveBeenCalledWith(0.3);
    expect(connectionStateMock.setTopA).toHaveBeenCalledWith(0.1);
    expect(connectionStateMock.setMinP).toHaveBeenCalledWith(0.2);
    expect(connectionStateMock.setRepetitionPenalty).toHaveBeenCalledWith(1.2);
    expect(connectionStateMock.setMaxContext).toHaveBeenCalledWith(8192);
    expect(connectionStateMock.setStreamEnabled).toHaveBeenCalledWith(false);
    expect(connectionStateMock.setSeed).toHaveBeenCalledWith(42);
    expect(connectionStateMock.setAssistantPrefill).toHaveBeenCalledWith("prefill");
    expect(connectionStateMock.setContinuePrefill).toHaveBeenCalledWith(true);
    expect(connectionStateMock.setContinuePostfix).toHaveBeenCalledWith("postfix");
    expect(connectionStateMock.setNamesBehavior).toHaveBeenCalledWith(1);
    expect(connectionStateMock.setSquashSystemMessages).toHaveBeenCalledWith(true);
    expect(connectionStateMock.setReverseProxy).toHaveBeenCalledWith("https://proxy.example");
    expect(loadFromPresetMock).toHaveBeenCalledWith(
      [{ identifier: "main", name: "Main", content: "Hello" }],
      [{ character_id: 100000, order: [{ identifier: "main", enabled: true }] }],
    );
  });

  it("applies sysprompt presets and ignores invalid preset data", () => {
    const syspromptPreset = createPresetFixture(
      "sysprompt",
      JSON.stringify({
        content: "System prompt",
        post_history: "Jailbreak prompt",
      }),
    );

    usePresetStore.getState().applyPreset(syspromptPreset);
    usePresetStore.getState().applyPreset(createPresetFixture("openai", "{invalid json"));

    expect(updateCustomContentMock).toHaveBeenCalledWith("main", "System prompt");
    expect(updateCustomContentMock).toHaveBeenCalledWith("jailbreak", "Jailbreak prompt");
    expect(loadFromPresetMock).not.toHaveBeenCalled();
  });
});
