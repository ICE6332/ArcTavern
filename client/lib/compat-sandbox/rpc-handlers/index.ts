/**
 * Registers all built-in RPC handlers with the global registry.
 * Call once at application startup (or sandbox panel mount).
 */

import type { RpcHandler } from "../rpc-registry";
import { registerRpcAlias, registerRpcHandler } from "../rpc-registry";
import { getContext, getVariables, requestWriteDone, getVariable, setVariable } from "./context";
import { runSlashCommand } from "./commands";

let registered = false;

export const builtinRpcHandlerEntries: ReadonlyArray<readonly [string, RpcHandler]> = [
  ["getContext", getContext],
  ["getVariables", getVariables],
  ["requestWriteDone", requestWriteDone],
  ["getVariable", getVariable],
  ["setVariable", setVariable],
  ["runSlashCommand", runSlashCommand],
] as const;

export const builtinRpcAliasEntries: ReadonlyArray<readonly [string, string]> = [] as const;

export function registerBuiltinHandlers(): void {
  if (registered) return;
  registered = true;

  for (const [method, handler] of builtinRpcHandlerEntries) {
    registerRpcHandler(method, handler);
  }

  for (const [alias, target] of builtinRpcAliasEntries) {
    registerRpcAlias(alias, target);
  }
}

export function resetBuiltinHandlersForTests(): void {
  registered = false;
}
