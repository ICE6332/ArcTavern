import { create } from "zustand";
import { groupApi, type Group, type GroupMember } from "@/lib/api/group";

interface GroupState {
  groups: Group[];
  selectedGroupId: string | null;
  members: GroupMember[];
  loading: boolean;

  fetchGroups: () => Promise<void>;
  selectGroup: (id: string | null) => Promise<void>;
  createGroup: (data: { name: string; activationStrategy?: number }) => Promise<Group>;
  updateGroup: (id: string, data: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMember: (groupId: string, characterId: number) => Promise<void>;
  removeMember: (groupId: string, characterId: number) => Promise<void>;
}

export const useGroupStore = create<GroupState>()((set, get) => ({
  groups: [],
  selectedGroupId: null,
  members: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const groups = await groupApi.getAll();
      set({ groups });
    } finally {
      set({ loading: false });
    }
  },

  selectGroup: async (id) => {
    set({ selectedGroupId: id, members: [] });
    if (id === null) return;
    set({ loading: true });
    try {
      const members = await groupApi.getMembers(id);
      set({ members });
    } finally {
      set({ loading: false });
    }
  },

  createGroup: async (data) => {
    const group = await groupApi.create(data);
    set((s) => ({ groups: [...s.groups, group] }));
    return group;
  },

  updateGroup: async (id, data) => {
    const updated = await groupApi.update(id, data);
    set((s) => ({ groups: s.groups.map((g) => (g.id === id ? updated : g)) }));
  },

  deleteGroup: async (id) => {
    await groupApi.delete(id);
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      selectedGroupId: s.selectedGroupId === id ? null : s.selectedGroupId,
      members: s.selectedGroupId === id ? [] : s.members,
    }));
  },

  addMember: async (groupId, characterId) => {
    const members = await groupApi.addMember(groupId, characterId);
    if (get().selectedGroupId === groupId) set({ members });
  },

  removeMember: async (groupId, characterId) => {
    const members = await groupApi.removeMember(groupId, characterId);
    if (get().selectedGroupId === groupId) set({ members });
  },
}));
