import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Provider = "openai" | "anthropic" | "google" | "openrouter" | "mistral" | "custom";

interface ConnectionState {
  provider: Provider;
  model: string;
  reverseProxy: string;
  apiKeyConfigured: Record<Provider, boolean>;
  connectionStatus: "idle" | "testing" | "ok" | "error";
  connectionMessage: string | null;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  customModels: string[];

  // Extended sampling parameters
  topA: number;
  minP: number;
  repetitionPenalty: number;
  maxContext: number;
  streamEnabled: boolean;
  seed: number;

  // Prompt templates / behavior
  assistantPrefill: string;
  continuePrefill: boolean;
  continuePostfix: string;
  namesBehavior: number;
  squashSystemMessages: boolean;
  openUiEnabled: boolean;

  setProvider: (provider: Provider) => void;
  setModel: (model: string) => void;
  setReverseProxy: (url: string) => void;
  setApiKeyConfigured: (provider: Provider, configured: boolean) => void;
  setConnectionStatus: (
    status: "idle" | "testing" | "ok" | "error",
    message?: string | null,
  ) => void;
  setTemperature: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setTopP: (v: number) => void;
  setTopK: (v: number) => void;
  setFrequencyPenalty: (v: number) => void;
  setPresencePenalty: (v: number) => void;
  setCustomModels: (models: string[]) => void;
  setTopA: (v: number) => void;
  setMinP: (v: number) => void;
  setRepetitionPenalty: (v: number) => void;
  setMaxContext: (v: number) => void;
  setStreamEnabled: (v: boolean) => void;
  setSeed: (v: number) => void;
  setAssistantPrefill: (v: string) => void;
  setContinuePrefill: (v: boolean) => void;
  setContinuePostfix: (v: string) => void;
  setNamesBehavior: (v: number) => void;
  setSquashSystemMessages: (v: boolean) => void;
  setOpenUiEnabled: (v: boolean) => void;
}

export const DEFAULT_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-4-20250514",
    "claude-3-5-sonnet-20241022",
  ],
  google: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", "google/gemini-2.0-flash"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  custom: [],
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => ({
      provider: "openai",
      model: "gpt-4o",
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

      // Extended defaults
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

      setProvider: (provider) => {
        const defaultModel = DEFAULT_MODELS[provider]?.[0] ?? "";
        set({
          provider,
          model: defaultModel,
          connectionStatus: "idle",
          connectionMessage: null,
        });
      },
      setModel: (model) => set({ model }),
      setReverseProxy: (reverseProxy) => set({ reverseProxy }),
      setApiKeyConfigured: (provider, configured) =>
        set((s) => ({
          apiKeyConfigured: { ...s.apiKeyConfigured, [provider]: configured },
        })),
      setConnectionStatus: (connectionStatus, connectionMessage = null) =>
        set({ connectionStatus, connectionMessage }),
      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      setTopP: (topP) => set({ topP }),
      setTopK: (topK) => set({ topK }),
      setFrequencyPenalty: (frequencyPenalty) => set({ frequencyPenalty }),
      setPresencePenalty: (presencePenalty) => set({ presencePenalty }),
      setCustomModels: (customModels) => set({ customModels }),
      setTopA: (topA) => set({ topA }),
      setMinP: (minP) => set({ minP }),
      setRepetitionPenalty: (repetitionPenalty) => set({ repetitionPenalty }),
      setMaxContext: (maxContext) => set({ maxContext }),
      setStreamEnabled: (streamEnabled) => set({ streamEnabled }),
      setSeed: (seed) => set({ seed }),
      setAssistantPrefill: (assistantPrefill) => set({ assistantPrefill }),
      setContinuePrefill: (continuePrefill) => set({ continuePrefill }),
      setContinuePostfix: (continuePostfix) => set({ continuePostfix }),
      setNamesBehavior: (namesBehavior) => set({ namesBehavior }),
      setSquashSystemMessages: (squashSystemMessages) => set({ squashSystemMessages }),
      setOpenUiEnabled: (openUiEnabled) => set({ openUiEnabled }),
    }),
    { name: "st-connection" },
  ),
);
