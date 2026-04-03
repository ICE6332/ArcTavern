/**
 * RPC handlers: MVU global initialization pattern.
 *
 * MVU framework uses `initializeGlobal(name, value)` / `waitGlobalInitialized(name)`
 * for cross-script coordination. We implement this as a simple in-memory registry
 * with event-based notification.
 */

import type { RpcHandler } from "../rpc-registry";

const globals = new Map<string, unknown>();
const waiters = new Map<string, Array<(value: unknown) => void>>();

/** initializeGlobal({ name, value }) */
export const initializeGlobal: RpcHandler = (params) => {
  const name = typeof params.name === "string" ? params.name : "";
  if (!name) return false;

  globals.set(name, params.value);

  const pending = waiters.get(name);
  if (pending) {
    for (const resolve of pending) {
      resolve(params.value);
    }
    waiters.delete(name);
  }
  return true;
};

/** waitGlobalInitialized({ name, timeout? }) */
export const waitGlobalInitialized: RpcHandler = (params) => {
  const name = typeof params.name === "string" ? params.name : "";
  if (!name) return Promise.resolve(undefined);

  if (globals.has(name)) {
    return globals.get(name);
  }

  const timeout = typeof params.timeout === "number" ? params.timeout : 30000;
  return new Promise<unknown>((resolve, reject) => {
    const list = waiters.get(name) ?? [];
    list.push(resolve);
    waiters.set(name, list);

    if (timeout > 0) {
      setTimeout(() => {
        const remaining = waiters.get(name);
        if (remaining) {
          const idx = remaining.indexOf(resolve);
          if (idx >= 0) {
            remaining.splice(idx, 1);
            if (remaining.length === 0) waiters.delete(name);
            reject(new Error(`waitGlobalInitialized("${name}") timed out after ${timeout}ms`));
          }
        }
      }, timeout);
    }
  });
};

/** getGlobal({ name }) */
export const getGlobal: RpcHandler = (params) => {
  const name = typeof params.name === "string" ? params.name : "";
  return globals.get(name);
};

/** clearGlobals() — resets all globals (for testing / character switch) */
export function clearGlobals(): void {
  globals.clear();
  for (const [, pending] of waiters) {
    for (const resolve of pending) {
      resolve(undefined);
    }
  }
  waiters.clear();
}
