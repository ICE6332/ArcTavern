import { create } from "zustand";
import { settingsApi } from "@/lib/api/settings";

export interface QuickReply {
  id: number;
  label: string;
  title?: string;
  message: string;
  isHidden: boolean;
  executeOnStartup: boolean;
  executeOnUser: boolean;
  executeOnAi: boolean;
  executeOnChatChange: boolean;
  executeOnNewChat: boolean;
  executeBeforeGeneration: boolean;
}

export interface QuickReplySet {
  name: string;
  scope: "global" | "chat" | "character";
  disableSend: boolean;
  placeBeforeInput: boolean;
  color?: string;
  qrList: QuickReply[];
}

type TriggerEvent = "startup" | "user" | "ai" | "chatChange" | "newChat" | "beforeGeneration";

interface QuickReplyState {
  sets: QuickReplySet[];
  loaded: boolean;

  // Actions
  loadSets: () => Promise<void>;
  saveSets: () => Promise<void>;
  addSet: (name: string, scope?: QuickReplySet["scope"]) => void;
  removeSet: (name: string) => void;
  addQr: (setName: string, qr: Omit<QuickReply, "id">) => void;
  removeQr: (setName: string, qrId: number) => void;
  updateQr: (setName: string, qrId: number, updates: Partial<QuickReply>) => void;
  updateSet: (name: string, updates: Partial<Omit<QuickReplySet, "qrList">>) => void;
  getTriggered: (event: TriggerEvent) => QuickReply[];
  getVisibleQrs: () => { qr: QuickReply; set: QuickReplySet }[];
}

const QR_SETTINGS_KEY = "qr:sets";
let nextId = 1;

export const useQuickReplyStore = create<QuickReplyState>()((set, get) => ({
  sets: [],
  loaded: false,

  loadSets: async () => {
    try {
      const data = await settingsApi.get(QR_SETTINGS_KEY);
      if (Array.isArray(data)) {
        const sets = data as QuickReplySet[];
        // Re-compute next ID
        for (const s of sets) {
          for (const qr of s.qrList) {
            if (qr.id >= nextId) nextId = qr.id + 1;
          }
        }
        set({ sets, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  saveSets: async () => {
    try {
      await settingsApi.set(QR_SETTINGS_KEY, get().sets);
    } catch (err) {
      console.error("Failed to save QR sets:", err);
    }
  },

  addSet: (name, scope = "global") => {
    set((state) => ({
      sets: [
        ...state.sets,
        {
          name,
          scope,
          disableSend: false,
          placeBeforeInput: false,
          qrList: [],
        },
      ],
    }));
    void get().saveSets();
  },

  removeSet: (name) => {
    set((state) => ({
      sets: state.sets.filter((s) => s.name !== name),
    }));
    void get().saveSets();
  },

  addQr: (setName, qr) => {
    const id = nextId++;
    set((state) => ({
      sets: state.sets.map((s) =>
        s.name === setName ? { ...s, qrList: [...s.qrList, { ...qr, id }] } : s,
      ),
    }));
    void get().saveSets();
  },

  removeQr: (setName, qrId) => {
    set((state) => ({
      sets: state.sets.map((s) =>
        s.name === setName ? { ...s, qrList: s.qrList.filter((q) => q.id !== qrId) } : s,
      ),
    }));
    void get().saveSets();
  },

  updateQr: (setName, qrId, updates) => {
    set((state) => ({
      sets: state.sets.map((s) =>
        s.name === setName
          ? {
              ...s,
              qrList: s.qrList.map((q) => (q.id === qrId ? { ...q, ...updates } : q)),
            }
          : s,
      ),
    }));
    void get().saveSets();
  },

  updateSet: (name, updates) => {
    set((state) => ({
      sets: state.sets.map((s) => (s.name === name ? { ...s, ...updates } : s)),
    }));
    void get().saveSets();
  },

  getTriggered: (event) => {
    const { sets } = get();
    const results: QuickReply[] = [];
    const triggerKey = {
      startup: "executeOnStartup",
      user: "executeOnUser",
      ai: "executeOnAi",
      chatChange: "executeOnChatChange",
      newChat: "executeOnNewChat",
      beforeGeneration: "executeBeforeGeneration",
    } as const;

    const key = triggerKey[event];
    for (const s of sets) {
      for (const qr of s.qrList) {
        if (qr[key]) results.push(qr);
      }
    }
    return results;
  },

  getVisibleQrs: () => {
    const { sets } = get();
    const results: { qr: QuickReply; set: QuickReplySet }[] = [];
    for (const s of sets) {
      for (const qr of s.qrList) {
        if (!qr.isHidden) {
          results.push({ qr, set: s });
        }
      }
    }
    return results;
  },
}));
