import { request } from "./core/http";
import { coalesceRaw, fromRaw, toRawRecord } from "./shared/raw";

export interface Preset {
  id: number;
  name: string;
  apiType: string;
  data: string;
  isDefault: boolean;
  sourceHash: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapPreset(rawInput: unknown): Preset {
  const raw = toRawRecord(rawInput);

  return {
    id: Number(raw.id),
    name: fromRaw(raw.name, ""),
    apiType: fromRaw(coalesceRaw(raw, "api_type", "apiType"), ""),
    data: fromRaw(raw.data, "{}"),
    isDefault: Boolean(coalesceRaw(raw, "is_default", "isDefault")),
    sourceHash: fromRaw(coalesceRaw(raw, "source_hash", "sourceHash"), null),
    createdAt: fromRaw(coalesceRaw(raw, "created_at", "createdAt"), ""),
    updatedAt: fromRaw(coalesceRaw(raw, "updated_at", "updatedAt"), ""),
  };
}

export const presetApi = {
  async getAll(apiType?: string) {
    const items = await request<unknown[]>(
      `/presets${apiType ? `?apiType=${encodeURIComponent(apiType)}` : ""}`,
    );
    return items.map(mapPreset);
  },
  async getOne(id: number) {
    return mapPreset(await request<unknown>(`/presets/${id}`));
  },
  async create(data: { name: string; apiType: string; data: string }) {
    return mapPreset(
      await request<unknown>("/presets", { method: "POST", body: JSON.stringify(data) }),
    );
  },
  async update(id: number, data: Partial<Preset>) {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.apiType !== undefined) payload.apiType = data.apiType;
    if (data.data !== undefined) payload.data = data.data;
    return mapPreset(
      await request<unknown>(`/presets/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    );
  },
  async delete(id: number) {
    return mapPreset(await request<unknown>(`/presets/${id}`, { method: "DELETE" }));
  },
  async import(name: string, apiType: string, data: Record<string, unknown>): Promise<Preset> {
    return mapPreset(
      await request<unknown>("/presets/import", {
        method: "POST",
        body: JSON.stringify({ name, apiType, data }),
      }),
    );
  },
  async export(
    id: number,
  ): Promise<{ name: string; apiType: string; data: Record<string, unknown> }> {
    return request(`/presets/${id}/export`);
  },
  async restore(id: number): Promise<{ isDefault: boolean; preset: Record<string, unknown> }> {
    return request(`/presets/${id}/restore`, { method: "POST" });
  },
  async getDefaults(apiType: string): Promise<string[]> {
    return request(`/presets/defaults/${apiType}`);
  },
};
