const CHAT_DEBUG_KEY = "chat-debug";

function parseBooleanLike(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isChatDebugEnabled(): boolean {
  const envValue = parseBooleanLike(import.meta.env.VITE_CHAT_DEBUG);
  if (envValue != null) return envValue;

  if (typeof window !== "undefined") {
    try {
      const storageValue = parseBooleanLike(window.localStorage.getItem(CHAT_DEBUG_KEY));
      if (storageValue != null) return storageValue;
    } catch {
      // Ignore storage errors in restricted contexts.
    }
  }

  return import.meta.env.MODE !== "production";
}

function nowLabel() {
  return new Date().toISOString();
}

export function chatDebug(event: string, payload?: unknown) {
  if (!isChatDebugEnabled()) return;
  if (payload === undefined) {
    console.debug(`[chat-debug][${nowLabel()}] ${event}`);
    return;
  }
  console.debug(`[chat-debug][${nowLabel()}] ${event}`, payload);
}

export function chatError(event: string, error: unknown, payload?: unknown) {
  if (!isChatDebugEnabled()) return;
  if (payload === undefined) {
    console.error(`[chat-debug][${nowLabel()}] ${event}`, error);
    return;
  }
  console.error(`[chat-debug][${nowLabel()}] ${event}`, error, payload);
}

export function setChatDebugEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_DEBUG_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}
