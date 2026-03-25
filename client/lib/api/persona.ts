import { getApiBase, request } from "./core/http";
import { coalesceRaw, fromRaw, toRawRecord } from "./shared/raw";

export interface Persona {
  id: string;
  name: string;
  description: string;
  position: number;
  depth: number;
  role: number;
  lorebookId: number | null;
  title: string | null;
  isDefault: boolean;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaConnection {
  personaId: string;
  entityType: string;
  entityId: string;
}

function mapPersona(rawInput: unknown): Persona {
  const raw = toRawRecord(rawInput);

  return {
    id: fromRaw(raw.id, ""),
    name: fromRaw(raw.name, ""),
    description: fromRaw(raw.description, ""),
    position: Number(raw.position ?? 0),
    depth: Number(raw.depth ?? 2),
    role: Number(raw.role ?? 0),
    lorebookId: fromRaw(coalesceRaw(raw, "lorebook_id", "lorebookId"), null),
    title: fromRaw(raw.title, null),
    isDefault: Boolean(coalesceRaw(raw, "is_default", "isDefault")),
    avatarPath: fromRaw(coalesceRaw(raw, "avatar_path", "avatarPath"), null),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

function mapPersonaConnection(rawInput: unknown): PersonaConnection {
  const raw = toRawRecord(rawInput);

  return {
    personaId: fromRaw(coalesceRaw(raw, "persona_id", "personaId"), ""),
    entityType: fromRaw(coalesceRaw(raw, "entity_type", "entityType"), ""),
    entityId: fromRaw(coalesceRaw(raw, "entity_id", "entityId"), ""),
  };
}

export const personaApi = {
  async getAll() {
    const items = await request<unknown[]>("/personas");
    return items.map(mapPersona);
  },
  async getOne(id: string) {
    return mapPersona(await request<unknown>(`/personas/${id}`));
  },
  async getDefault() {
    const raw = await request<unknown>("/personas/default");
    return raw ? mapPersona(raw) : null;
  },
  async create(data: {
    name: string;
    description?: string;
    position?: number;
    depth?: number;
    role?: number;
    isDefault?: boolean;
  }) {
    return mapPersona(
      await request<unknown>("/personas", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async update(id: string, data: Partial<Persona>) {
    return mapPersona(
      await request<unknown>(`/personas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    );
  },
  async delete(id: string) {
    return mapPersona(await request<unknown>(`/personas/${id}`, { method: "DELETE" }));
  },
  async uploadAvatar(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${getApiBase()}/personas/${id}/avatar`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${await res.text()}`);
    }

    return mapPersona(await res.json());
  },
  async getConnections(id: string) {
    const items = await request<unknown[]>(`/personas/${id}/connections`);
    return items.map(mapPersonaConnection);
  },
  async updateConnections(
    id: string,
    connections: Array<{ entityType: string; entityId: string }>,
  ) {
    const items = await request<unknown[]>(`/personas/${id}/connections`, {
      method: "PUT",
      body: JSON.stringify({ connections }),
    });
    return items.map(mapPersonaConnection);
  },
  async findForEntity(entityType: string, entityId: string) {
    const items = await request<unknown[]>(`/personas/for/${entityType}/${entityId}`);
    return items.map(mapPersona);
  },
};
