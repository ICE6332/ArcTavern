import { create } from "zustand";
import { persist } from "zustand/middleware";
import { presetApi, type Preset } from "@/lib/api";
import { useConnectionStore } from "./connection-store";
import { usePromptManagerStore } from "./prompt-manager-store";

interface PresetState {
  /** Presets grouped by api_type */
  presets: Record<string, Preset[]>;

  /** Currently active preset ID per api_type */
  activePresetId: Record<string, number | null>;

  /** Load presets for a given api type */
  loadPresets: (apiType: string) => Promise<void>;

  /** Select the active preset for a type */
  selectPreset: (apiType: string, presetId: number | null) => void;

  /** Save a new preset from current settings */
  savePreset: (name: string, apiType: string, data: Record<string, unknown>) => Promise<Preset>;

  /** Update an existing preset's data */
  updatePreset: (id: number, apiType: string, data: Record<string, unknown>) => Promise<void>;

  /** Delete a preset */
  deletePreset: (id: number, apiType: string) => Promise<void>;

  /** Import a preset from JSON */
  importPreset: (
    name: string,
    apiType: string,
    jsonData: Record<string, unknown>,
  ) => Promise<Preset>;

  /** Restore a default preset to its original state */
  restorePreset: (id: number, apiType: string) => Promise<void>;

  /** Apply a preset's data to connection-store and prompt-manager-store */
  applyPreset: (preset: Preset) => void;

  /** Collect current settings into a data blob for saving */
  collectCurrentSettings: (apiType: string) => Record<string, unknown>;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: {},
      activePresetId: {},

      loadPresets: async (apiType) => {
        const items = await presetApi.getAll(apiType);
        set((s) => ({
          presets: { ...s.presets, [apiType]: items },
        }));
      },

      selectPreset: (apiType, presetId) => {
        set((s) => ({
          activePresetId: { ...s.activePresetId, [apiType]: presetId },
        }));
      },

      savePreset: async (name, apiType, data) => {
        const preset = await presetApi.create({
          name,
          apiType,
          data: JSON.stringify(data),
        });
        await get().loadPresets(apiType);
        return preset;
      },

      updatePreset: async (id, apiType, data) => {
        await presetApi.update(id, { data: JSON.stringify(data) } as Partial<Preset>);
        await get().loadPresets(apiType);
      },

      deletePreset: async (id, apiType) => {
        await presetApi.delete(id);
        set((s) => ({
          activePresetId:
            s.activePresetId[apiType] === id
              ? { ...s.activePresetId, [apiType]: null }
              : s.activePresetId,
        }));
        await get().loadPresets(apiType);
      },

      importPreset: async (name, apiType, jsonData) => {
        const preset = await presetApi.import(name, apiType, jsonData);
        await get().loadPresets(apiType);
        return preset;
      },

      restorePreset: async (id, apiType) => {
        await presetApi.restore(id);
        await get().loadPresets(apiType);
      },

      applyPreset: (preset) => {
        let data: Record<string, unknown>;
        try {
          data = typeof preset.data === "string" ? JSON.parse(preset.data) : preset.data;
        } catch {
          return;
        }

        const conn = useConnectionStore.getState();
        const promptMgr = usePromptManagerStore.getState();

        if (preset.apiType === "openai") {
          // Do not override provider/model from preset to avoid breaking
          // an already configured connection (e.g. custom proxy setup).

          // Sampling parameters
          if (typeof data.temperature === "number") conn.setTemperature(data.temperature);
          if (typeof data.openai_max_tokens === "number") conn.setMaxTokens(data.openai_max_tokens);
          if (typeof data.top_p === "number") conn.setTopP(data.top_p);
          if (typeof data.top_k === "number") conn.setTopK(data.top_k);
          if (typeof data.frequency_penalty === "number")
            conn.setFrequencyPenalty(data.frequency_penalty);
          if (typeof data.presence_penalty === "number")
            conn.setPresencePenalty(data.presence_penalty);
          if (typeof data.top_a === "number") conn.setTopA(data.top_a);
          if (typeof data.min_p === "number") conn.setMinP(data.min_p);
          if (typeof data.repetition_penalty === "number")
            conn.setRepetitionPenalty(data.repetition_penalty);
          if (typeof data.openai_max_context === "number")
            conn.setMaxContext(data.openai_max_context);
          if (typeof data.stream_openai === "boolean") conn.setStreamEnabled(data.stream_openai);
          if (typeof data.seed === "number") conn.setSeed(data.seed);

          // Prompt behavior
          if (typeof data.assistant_prefill === "string")
            conn.setAssistantPrefill(data.assistant_prefill);
          if (typeof data.continue_prefill === "boolean")
            conn.setContinuePrefill(data.continue_prefill);
          if (typeof data.continue_postfix === "string")
            conn.setContinuePostfix(data.continue_postfix);
          if (typeof data.names_behavior === "number") conn.setNamesBehavior(data.names_behavior);
          if (typeof data.squash_system_messages === "boolean")
            conn.setSquashSystemMessages(data.squash_system_messages);

          // Reverse proxy
          if (typeof data.reverse_proxy === "string") conn.setReverseProxy(data.reverse_proxy);

          // Prompt order
          if (Array.isArray(data.prompts) && Array.isArray(data.prompt_order)) {
            promptMgr.loadFromPreset(
              data.prompts as Array<{
                identifier: string;
                name: string;
                role?: string;
                content?: string;
                marker?: boolean;
              }>,
              data.prompt_order as Array<{
                character_id: number;
                order: Array<{ identifier: string; enabled: boolean }>;
              }>,
            );
          }
        } else if (preset.apiType === "sysprompt") {
          // System prompt presets apply to the 'main' component content
          if (typeof data.content === "string") {
            promptMgr.updateCustomContent("main", data.content);
          }
          if (typeof data.post_history === "string") {
            promptMgr.updateCustomContent("jailbreak", data.post_history);
          }
        }
        // kobold, textgen, instruct, context, reasoning, novel — stored but not applied to connection-store yet
      },

      collectCurrentSettings: (apiType) => {
        const conn = useConnectionStore.getState();
        const promptMgr = usePromptManagerStore.getState();

        if (apiType === "openai") {
          const { prompts, prompt_order } = promptMgr.exportToPresetFormat();
          return {
            temperature: conn.temperature,
            openai_max_tokens: conn.maxTokens,
            top_p: conn.topP,
            top_k: conn.topK,
            frequency_penalty: conn.frequencyPenalty,
            presence_penalty: conn.presencePenalty,
            top_a: conn.topA,
            min_p: conn.minP,
            repetition_penalty: conn.repetitionPenalty,
            openai_max_context: conn.maxContext,
            stream_openai: conn.streamEnabled,
            seed: conn.seed,
            assistant_prefill: conn.assistantPrefill,
            continue_prefill: conn.continuePrefill,
            continue_postfix: conn.continuePostfix,
            names_behavior: conn.namesBehavior,
            squash_system_messages: conn.squashSystemMessages,
            reverse_proxy: conn.reverseProxy,
            prompts,
            prompt_order,
          };
        }

        return {
          temperature: conn.temperature,
          maxTokens: conn.maxTokens,
          topP: conn.topP,
          topK: conn.topK,
          frequencyPenalty: conn.frequencyPenalty,
          presencePenalty: conn.presencePenalty,
        };
      },
    }),
    {
      name: "st-presets",
      partialize: (state) => ({
        activePresetId: state.activePresetId,
      }),
    },
  ),
);
