import { request } from "./core/http";

export const secretApi = {
  listKeys: () => request<string[]>("/secrets"),
  set: (key: string, value: string) =>
    request("/secrets", { method: "POST", body: JSON.stringify({ key, value }) }),
  delete: (key: string) => request(`/secrets/${key}`, { method: "DELETE" }),
};
