import { create } from "zustand";
import { settingsApi } from "@/lib/api/settings";
import type { RegexScriptData } from "@/lib/compat/regex-engine";

const SETTINGS_KEY = "regex_scripts_global";

type RegexScope = "global" | "character";

interface RegexState {
  globalScripts: RegexScriptData[];
  characterScripts: RegexScriptData[];
  scope: RegexScope;
  loading: boolean;
  loadedGlobalScripts: boolean;

  setScope: (scope: RegexScope) => void;
  fetchGlobalScripts: () => Promise<void>;
  setCharacterScripts: (scripts: RegexScriptData[]) => void;
  saveGlobalScripts: () => Promise<void>;
  addScript: () => string;
  updateScript: (id: string, data: Partial<RegexScriptData>) => void;
  deleteScript: (id: string) => void;
  toggleScript: (id: string) => void;
}

function ensureIds(scripts: RegexScriptData[]): RegexScriptData[] {
  return scripts.map((s) => (s.id ? s : { ...s, id: crypto.randomUUID() }));
}

function activeList(state: RegexState): "globalScripts" | "characterScripts" {
  return state.scope === "global" ? "globalScripts" : "characterScripts";
}

export const useRegexStore = create<RegexState>()((set, get) => ({
  globalScripts: [],
  characterScripts: [],
  scope: "global" as RegexScope,
  loading: false,
  loadedGlobalScripts: false,

  setScope: (scope) => set({ scope }),

  fetchGlobalScripts: async () => {
    set({ loading: true });
    try {
      const raw = await settingsApi.get(SETTINGS_KEY);
      const scripts = Array.isArray(raw) ? ensureIds(raw as RegexScriptData[]) : [];
      set({ globalScripts: scripts, loadedGlobalScripts: true });
    } catch {
      set({ globalScripts: [], loadedGlobalScripts: true });
    } finally {
      set({ loading: false });
    }
  },

  setCharacterScripts: (scripts) => {
    set({ characterScripts: ensureIds(scripts) });
  },

  saveGlobalScripts: async () => {
    await settingsApi.set(SETTINGS_KEY, get().globalScripts);
  },

  addScript: () => {
    const id = crypto.randomUUID();
    const newScript: RegexScriptData = {
      id,
      scriptName: "New Script",
      findRegex: "",
      replaceString: "",
      trimStrings: [],
      placement: [2],
      disabled: false,
    };
    const key = activeList(get());
    set((s) => ({ [key]: [...s[key], newScript] }));
    return id;
  },

  updateScript: (id, data) => {
    const key = activeList(get());
    set((s) => ({
      [key]: s[key].map((script) => (script.id === id ? { ...script, ...data } : script)),
    }));
  },

  deleteScript: (id) => {
    const key = activeList(get());
    set((s) => ({
      [key]: s[key].filter((script) => script.id !== id),
    }));
  },

  toggleScript: (id) => {
    const key = activeList(get());
    set((s) => ({
      [key]: s[key].map((script) =>
        script.id === id ? { ...script, disabled: !script.disabled } : script,
      ),
    }));
  },
}));
