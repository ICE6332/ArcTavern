import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Provider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'mistral' | 'custom';

interface ConnectionState {
  provider: Provider;
  model: string;
  reverseProxy: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;

  setProvider: (provider: Provider) => void;
  setModel: (model: string) => void;
  setReverseProxy: (url: string) => void;
  setTemperature: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setTopP: (v: number) => void;
  setTopK: (v: number) => void;
  setFrequencyPenalty: (v: number) => void;
  setPresencePenalty: (v: number) => void;
}

export const DEFAULT_MODELS: Record<Provider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514', 'claude-3-5-sonnet-20241022'],
  google: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.0-flash'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  custom: [],
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set) => ({
      provider: 'openai',
      model: 'gpt-4o',
      reverseProxy: '',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,

      setProvider: (provider) => {
        const defaultModel = DEFAULT_MODELS[provider]?.[0] ?? '';
        set({ provider, model: defaultModel });
      },
      setModel: (model) => set({ model }),
      setReverseProxy: (reverseProxy) => set({ reverseProxy }),
      setTemperature: (temperature) => set({ temperature }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      setTopP: (topP) => set({ topP }),
      setTopK: (topK) => set({ topK }),
      setFrequencyPenalty: (frequencyPenalty) => set({ frequencyPenalty }),
      setPresencePenalty: (presencePenalty) => set({ presencePenalty }),
    }),
    { name: 'st-connection' },
  ),
);
