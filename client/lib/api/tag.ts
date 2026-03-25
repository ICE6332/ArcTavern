import { request } from "./core/http";
import { coalesceRaw, fromRaw, toRawRecord } from "./shared/raw";

export interface Tag {
  id: string;
  name: string;
  folderType: string;
  sortOrder: number;
  color: string | null;
  color2: string | null;
  isHidden: boolean;
  createdAt: string;
}

function mapTag(rawInput: unknown): Tag {
  const raw = toRawRecord(rawInput);

  return {
    id: fromRaw(raw.id, ""),
    name: fromRaw(raw.name, ""),
    folderType: fromRaw(coalesceRaw(raw, "folder_type", "folderType"), "NONE"),
    sortOrder: Number(coalesceRaw(raw, "sort_order", "sortOrder") ?? 0),
    color: fromRaw(raw.color, null),
    color2: fromRaw(raw.color2, null),
    isHidden: Boolean(coalesceRaw(raw, "is_hidden", "isHidden")),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
  };
}

export const tagApi = {
  async getAll() {
    const items = await request<unknown[]>("/tags");
    return items.map(mapTag);
  },
  async getOne(id: string) {
    return mapTag(await request<unknown>(`/tags/${id}`));
  },
  async create(data: {
    name: string;
    folderType?: string;
    sortOrder?: number;
    color?: string;
    color2?: string;
  }) {
    return mapTag(await request<unknown>("/tags", { method: "POST", body: JSON.stringify(data) }));
  },
  async update(id: string, data: Partial<Tag>) {
    return mapTag(
      await request<unknown>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    );
  },
  async delete(id: string) {
    return mapTag(await request<unknown>(`/tags/${id}`, { method: "DELETE" }));
  },
  async assign(entityType: string, entityId: string, tagId: string) {
    return request("/tags/assign", {
      method: "POST",
      body: JSON.stringify({ entityType, entityId, tagId }),
    });
  },
  async unassign(entityType: string, entityId: string, tagId: string) {
    return request("/tags/unassign", {
      method: "DELETE",
      body: JSON.stringify({ entityType, entityId, tagId }),
    });
  },
  async getEntityTags(entityType: string, entityId: string) {
    const items = await request<unknown[]>(`/tags/entity/${entityType}/${entityId}`);
    return items.map(mapTag);
  },
};
