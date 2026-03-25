export function getApiBase() {
  const explicitApiBase = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");

  return explicitApiBase || "/api";
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

export async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await fetch(`${getApiBase()}${path}`, options);

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.blob();
}
