/**
 * Minimal ST-like API surface for iframe scripts. Built via factory — no store imports.
 * Variables persist in `message.extra.stCompatVars` (array indexed by swipe, like ST variables[]).
 */

export const ST_COMPAT_VARS_KEY = "stCompatVars" as const;

export interface CompatApiDeps {
  swipeId: number;
  /** Used to size the variables array; at least swipeId + 1 */
  swipesLength: number;
  getExtra: () => Record<string, unknown>;
  persistExtra: (nextExtra: Record<string, unknown>) => Promise<void>;
  getMessages: (count?: number) => { role: string; content: string }[];
  getCharName: () => string;
  getCharAvatar: () => string;
}

function mergeVarRow(
  extra: Record<string, unknown>,
  swipeId: number,
  minLength: number,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const next = { ...extra };
  const raw = next[ST_COMPAT_VARS_KEY];
  const arr: unknown[] = Array.isArray(raw) ? [...raw] : [];
  while (arr.length < minLength) {
    arr.push({});
  }
  const prevRow =
    typeof arr[swipeId] === "object" && arr[swipeId] !== null
      ? { ...(arr[swipeId] as Record<string, unknown>) }
      : {};
  prevRow[key] = value;
  arr[swipeId] = prevRow;
  next[ST_COMPAT_VARS_KEY] = arr;
  return next;
}

export function createCompatApiBindings(deps: CompatApiDeps): Record<string, unknown> {
  const { swipeId, swipesLength, getExtra, persistExtra, getMessages } = deps;

  function getVar(key: string): unknown {
    const extra = getExtra();
    const raw = extra[ST_COMPAT_VARS_KEY];
    if (!Array.isArray(raw)) return undefined;
    const row = raw[swipeId];
    if (!row || typeof row !== "object") return undefined;
    return (row as Record<string, unknown>)[key];
  }

  function setVar(key: string, value: unknown): void {
    void (async () => {
      const extra = getExtra();
      const len = Math.max(swipesLength, swipeId + 1, 1);
      const next = mergeVarRow(extra, swipeId, len, key, value);
      await persistExtra(next);
    })();
  }

  function addVar(key: string, delta: number): void {
    const cur = Number(getVar(key) ?? 0);
    setVar(key, cur + delta);
  }

  function getLastMessage(): { role: string; content: string } | null {
    const msgs = getMessages();
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1] ?? null;
  }

  return {
    getVar,
    setVar,
    addVar,
    getMessages,
    getLastMessage,
    getCharName: deps.getCharName,
    getCharAvatar: deps.getCharAvatar,
    requestUiRefresh: () => {},
  };
}
