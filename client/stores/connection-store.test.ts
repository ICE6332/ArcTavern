import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MODELS, useConnectionStore } from "./connection-store";

describe("useConnectionStore", () => {
  it("starts with the latest OpenAI default model", () => {
    expect(useConnectionStore.getInitialState().provider).toBe("openai");
    expect(useConnectionStore.getInitialState().model).toBe("gpt-5.2");
  });

  beforeEach(() => {
    useConnectionStore.setState({
      provider: "openai",
      model: "gpt-5.2",
      reverseProxy: "",
      apiKeyConfigured: {
        openai: false,
        anthropic: false,
        google: false,
        openrouter: false,
        mistral: false,
        custom: false,
      },
      connectionStatus: "idle",
      connectionMessage: null,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      customModels: [],
      topA: 0,
      minP: 0,
      repetitionPenalty: 1,
      maxContext: 4096,
      streamEnabled: true,
      seed: -1,
      assistantPrefill: "",
      continuePrefill: false,
      continuePostfix: "",
      namesBehavior: 0,
      squashSystemMessages: false,
      openUiEnabled: false,
      customApiFormat: "openai-compatible",
    });
  });

  afterEach(() => undefined);

  it("switches to the provider default model and resets connection state", () => {
    useConnectionStore.setState({
      model: "custom-model",
      connectionStatus: "error",
      connectionMessage: "boom",
    });

    useConnectionStore.getState().setProvider("anthropic");

    const state = useConnectionStore.getState();
    expect(state.provider).toBe("anthropic");
    expect(state.model).toBe(DEFAULT_MODELS.anthropic[0]);
    expect(state.connectionStatus).toBe("idle");
    expect(state.connectionMessage).toBeNull();
  });

  it("updates API key flags, status, and sampling values", () => {
    const state = useConnectionStore.getState();

    state.setApiKeyConfigured("openrouter", true);
    state.setConnectionStatus("testing", "Checking");
    state.setTemperature(1.1);
    state.setMaxTokens(8192);
    state.setTopP(0.85);

    const next = useConnectionStore.getState();
    expect(next.apiKeyConfigured.openrouter).toBe(true);
    expect(next.connectionStatus).toBe("testing");
    expect(next.connectionMessage).toBe("Checking");
    expect(next.temperature).toBe(1.1);
    expect(next.maxTokens).toBe(8192);
    expect(next.topP).toBe(0.85);
  });
});
