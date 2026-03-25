import { request } from "./core/http";

export const settingsApi = {
  getAll: () => request<Record<string, unknown>>("/settings"),
  get: (key: string) => request(`/settings/${key}`),
  set: (key: string, value: unknown) =>
    request("/settings", { method: "POST", body: JSON.stringify({ key, value }) }),
};
