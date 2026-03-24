import type { ExecutionContext } from "./types";
import { useVariableStore } from "@/stores/variable-store";

/**
 * Resolve a variable by name using the three-scope chain:
 *   execution → chat-local → global
 */
export function getVariable(name: string, context: ExecutionContext): string | undefined {
  // 1. Execution scope (per-pipeline)
  const execVal = context.variables.get(name);
  if (execVal !== undefined) return execVal;

  // 2. Chat-local scope
  const store = useVariableStore.getState();
  const localVal = store.chatVariables[name];
  if (localVal !== undefined) return localVal;

  // 3. Global scope
  const globalVal = store.globalVariables[name];
  if (globalVal !== undefined) return globalVal;

  return undefined;
}

export function getGlobalVariable(name: string): string | undefined {
  const store = useVariableStore.getState();
  return store.globalVariables[name];
}

/**
 * Set a variable in the specified scope.
 */
export function setVariable(
  scope: "exec" | "local" | "global",
  name: string,
  value: string,
  context: ExecutionContext,
): void {
  const store = useVariableStore.getState();

  switch (scope) {
    case "exec":
      context.variables.set(name, value);
      break;
    case "local":
      store.setChatVariable(name, value);
      break;
    case "global":
      store.setGlobalVariable(name, value);
      break;
  }
}

/**
 * Delete a variable from the specified scope.
 */
export function deleteVariable(scope: "local" | "global", name: string): void {
  const store = useVariableStore.getState();
  if (scope === "local") {
    store.deleteChatVariable(name);
  } else {
    store.deleteGlobalVariable(name);
  }
}

/**
 * Increment a numeric variable by 1.
 */
export function incrementVariable(
  scope: "local" | "global",
  name: string,
  context: ExecutionContext,
): string {
  return addToVariable(scope, name, "1", context);
}

/**
 * Decrement a numeric variable by 1.
 */
export function decrementVariable(
  scope: "local" | "global",
  name: string,
  context: ExecutionContext,
): string {
  return addToVariable(scope, name, "-1", context);
}

/**
 * Add a numeric value to a variable.
 */
export function addToVariable(
  scope: "local" | "global",
  name: string,
  value: string,
  context: ExecutionContext,
): string {
  const current = getVariable(name, context) ?? "0";
  const num = parseFloat(current) + parseFloat(value);
  const result = String(isNaN(num) ? 0 : num);
  setVariable(scope, name, result, context);
  return result;
}

/**
 * List all variables, optionally filtered by scope.
 */
export function listVariables(scope: "all" | "local" | "global" = "all"): Record<string, string> {
  const store = useVariableStore.getState();
  const result: Record<string, string> = {};

  if (scope === "all" || scope === "global") {
    for (const [k, v] of Object.entries(store.globalVariables)) {
      result[`global:${k}`] = v;
    }
  }
  if (scope === "all" || scope === "local") {
    for (const [k, v] of Object.entries(store.chatVariables)) {
      result[`local:${k}`] = v;
    }
  }

  return result;
}
