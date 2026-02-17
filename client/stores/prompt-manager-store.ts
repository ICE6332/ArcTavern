import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PromptComponent {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
  role: "system" | "user" | "assistant";
  content?: string;
  isBuiltIn: boolean;
  isMarker: boolean;
}

/** Original ST prompt entry format */
interface STPromptEntry {
  identifier: string;
  name: string;
  system_prompt?: boolean;
  role?: string;
  content?: string;
  marker?: boolean;
}

/** Original ST prompt order entry format */
interface STPromptOrderEntry {
  character_id: number;
  order: Array<{ identifier: string; enabled: boolean }>;
}

const DEFAULT_COMPONENTS: PromptComponent[] = [
  { id: "main", name: "Main Prompt", enabled: true, position: 0, role: "system", isBuiltIn: true, isMarker: false },
  { id: "worldInfoBefore", name: "World Info (Before)", enabled: true, position: 1, role: "system", isBuiltIn: true, isMarker: true },
  { id: "charDescription", name: "Character Description", enabled: true, position: 2, role: "system", isBuiltIn: true, isMarker: true },
  { id: "charPersonality", name: "Character Personality", enabled: true, position: 3, role: "system", isBuiltIn: true, isMarker: true },
  { id: "scenario", name: "Scenario", enabled: true, position: 4, role: "system", isBuiltIn: true, isMarker: true },
  { id: "enhanceDefinitions", name: "Enhance Definitions", enabled: false, position: 5, role: "system", isBuiltIn: true, isMarker: false },
  { id: "nsfw", name: "NSFW Prompt", enabled: true, position: 6, role: "system", isBuiltIn: true, isMarker: false },
  { id: "worldInfoAfter", name: "World Info (After)", enabled: true, position: 7, role: "system", isBuiltIn: true, isMarker: true },
  { id: "personaDescription", name: "Persona Description", enabled: true, position: 8, role: "system", isBuiltIn: true, isMarker: true },
  { id: "dialogueExamples", name: "Chat Examples", enabled: true, position: 9, role: "system", isBuiltIn: true, isMarker: true },
  { id: "chatHistory", name: "Chat History", enabled: true, position: 10, role: "system", isBuiltIn: true, isMarker: true },
  { id: "jailbreak", name: "Post-History Instructions", enabled: true, position: 11, role: "system", isBuiltIn: true, isMarker: false },
];
const BUILT_IN_IDS = new Set(DEFAULT_COMPONENTS.map((component) => component.id));

interface PromptManagerState {
  components: PromptComponent[];
  setComponents: (components: PromptComponent[]) => void;
  toggleComponent: (id: string) => void;
  moveComponent: (id: string, newPosition: number) => void;
  updateComponent: (
    id: string,
    patch: Partial<Pick<PromptComponent, "name" | "role" | "content" | "enabled">>,
  ) => void;
  addCustomComponent: (name: string, role: "system" | "user" | "assistant", content: string) => void;
  removeCustomComponent: (id: string) => void;
  updateCustomContent: (id: string, content: string) => void;
  resetToDefaults: () => void;

  /** Load prompt order from original ST preset format */
  loadFromPreset: (prompts: STPromptEntry[], promptOrder: STPromptOrderEntry[]) => void;

  /** Export current state to original ST preset format */
  exportToPresetFormat: () => { prompts: STPromptEntry[]; prompt_order: STPromptOrderEntry[] };
}

export const usePromptManagerStore = create<PromptManagerState>()(
  persist(
    (set, get) => ({
      components: DEFAULT_COMPONENTS,

      setComponents: (components) => set({ components }),

      toggleComponent: (id) =>
        set((s) => ({
          components: s.components.map((c) =>
            c.id === id ? { ...c, enabled: !c.enabled } : c,
          ),
        })),

      moveComponent: (id, newPosition) =>
        set((s) => {
          const items = [...s.components];
          const oldIndex = items.findIndex((c) => c.id === id);
          if (oldIndex === -1) return s;
          const [moved] = items.splice(oldIndex, 1);
          items.splice(newPosition, 0, moved);
          return {
            components: items.map((c, i) => ({ ...c, position: i })),
          };
        }),

      updateComponent: (id, patch) =>
        set((s) => ({
          components: s.components.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.role !== undefined ? { role: patch.role } : {}),
                  ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
                  ...(patch.content !== undefined ? { content: patch.content } : {}),
                }
              : c,
          ),
        })),

      addCustomComponent: (name, role, content) =>
        set((s) => ({
          components: [
            ...s.components,
            {
              id: `custom_${Date.now()}`,
              name,
              enabled: true,
              position: s.components.length,
              role,
              content,
              isBuiltIn: false,
              isMarker: false,
            },
          ],
        })),

      removeCustomComponent: (id) =>
        set((s) => ({
          components: s.components
            .filter((c) => c.id !== id)
            .map((c, i) => ({ ...c, position: i })),
        })),

      updateCustomContent: (id, content) =>
        get().updateComponent(id, { content }),

      resetToDefaults: () => set({ components: DEFAULT_COMPONENTS }),

      loadFromPreset: (prompts, promptOrder) => {
        // Find global order (character_id: 100001) or default (100000) or first
        const globalOrder =
          promptOrder.find((o) => o.character_id === 100001) ??
          promptOrder.find((o) => o.character_id === 100000) ??
          promptOrder[0];

        if (!globalOrder) return;

        const components: PromptComponent[] = [];
        let position = 0;

        for (const orderItem of globalOrder.order) {
          const promptDef = prompts.find(
            (p) => p.identifier === orderItem.identifier,
          );
          if (!promptDef) continue;

          components.push({
            id: promptDef.identifier,
            name: promptDef.name,
            enabled: orderItem.enabled,
            position: position++,
            role: (promptDef.role as "system" | "user" | "assistant") ?? "system",
            content: promptDef.content,
            isBuiltIn: BUILT_IN_IDS.has(promptDef.identifier) || !!promptDef.marker,
            isMarker: !!promptDef.marker,
          });
        }

        // Add prompts that are defined but not in the order (appended, disabled)
        for (const promptDef of prompts) {
          if (!components.find((c) => c.id === promptDef.identifier)) {
            components.push({
              id: promptDef.identifier,
              name: promptDef.name,
              enabled: false,
              position: position++,
              role: (promptDef.role as "system" | "user" | "assistant") ?? "system",
              content: promptDef.content,
              isBuiltIn: BUILT_IN_IDS.has(promptDef.identifier) || !!promptDef.marker,
              isMarker: !!promptDef.marker,
            });
          }
        }

        set({ components });
      },

      exportToPresetFormat: () => {
        const { components } = get();
        const sorted = [...components].sort((a, b) => a.position - b.position);

        const prompts: STPromptEntry[] = sorted.map((c) => ({
          identifier: c.id,
          name: c.name,
          system_prompt: c.role === "system",
          role: c.role,
          ...(c.isMarker ? { marker: true } : { content: c.content ?? "" }),
        }));

        const prompt_order: STPromptOrderEntry[] = [
          {
            character_id: 100000,
            order: sorted.map((c) => ({
              identifier: c.id,
              enabled: c.enabled,
            })),
          },
        ];

        return { prompts, prompt_order };
      },
    }),
    { name: "st-prompt-manager" },
  ),
);
