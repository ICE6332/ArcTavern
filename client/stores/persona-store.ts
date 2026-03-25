import { create } from "zustand";
import { personaApi, type Persona } from "@/lib/api/persona";

interface PersonaState {
  personas: Persona[];
  activePersonaId: string | null;
  loading: boolean;

  fetchPersonas: () => Promise<void>;
  createPersona: (data: {
    name: string;
    description?: string;
    isDefault?: boolean;
  }) => Promise<Persona>;
  updatePersona: (id: string, data: Partial<Persona>) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  setActivePersona: (id: string | null) => void;
  getActivePersona: () => Persona | null;
  autoSwitchForEntity: (entityType: string, entityId: string) => Promise<void>;
}

export const usePersonaStore = create<PersonaState>()((set, get) => ({
  personas: [],
  activePersonaId: null,
  loading: false,

  fetchPersonas: async () => {
    set({ loading: true });
    try {
      const personas = await personaApi.getAll();
      set({ personas });
      // Set default persona as active if none selected
      if (!get().activePersonaId) {
        const defaultPersona = personas.find((p) => p.isDefault);
        if (defaultPersona) set({ activePersonaId: defaultPersona.id });
      }
    } finally {
      set({ loading: false });
    }
  },

  createPersona: async (data) => {
    const persona = await personaApi.create(data);
    set((s) => ({ personas: [...s.personas, persona] }));
    return persona;
  },

  updatePersona: async (id, data) => {
    const updated = await personaApi.update(id, data);
    set((s) => ({ personas: s.personas.map((p) => (p.id === id ? updated : p)) }));
  },

  deletePersona: async (id) => {
    await personaApi.delete(id);
    set((s) => ({
      personas: s.personas.filter((p) => p.id !== id),
      activePersonaId: s.activePersonaId === id ? null : s.activePersonaId,
    }));
  },

  setActivePersona: (id) => set({ activePersonaId: id }),

  getActivePersona: () => {
    const { personas, activePersonaId } = get();
    return personas.find((p) => p.id === activePersonaId) ?? null;
  },

  autoSwitchForEntity: async (entityType, entityId) => {
    try {
      const connected = await personaApi.findForEntity(entityType, entityId);
      if (connected.length > 0) {
        set({ activePersonaId: connected[0].id });
      }
    } catch {
      // Silently fail - keep current persona
    }
  },
}));
