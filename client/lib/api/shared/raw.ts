export type RawRecord = Record<string, unknown>;

export function toRawRecord(value: unknown): RawRecord {
  if (value && typeof value === "object") {
    return value as RawRecord;
  }

  return {};
}

export function coalesceRaw(raw: RawRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

export function fromRaw<T>(value: unknown, fallback: T): T {
  return (value as T | null | undefined) ?? fallback;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return (value as T) ?? fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
