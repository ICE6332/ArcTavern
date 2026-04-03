/**
 * RPC handler registry for the compat sandbox bridge.
 *
 * Both the sandbox panel (MessagePort bridge) and the per-message widget
 * (postMessage bridge) dispatch RPC calls through this shared registry,
 * keeping handler logic in one place and making new methods a one-liner
 * registration.
 */

/** Snapshot of host-side state passed to every RPC handler. */
export interface RpcContext {
  chatId: number | null;
  characterId: number | null;
  /** Current message context (only set for per-message widget RPCs). */
  messageId?: number;
  swipeId?: number;
  /** Opaque extras attached by the host component (e.g. compatData). */
  extras: Record<string, unknown>;
}

export type RpcHandler = (
  params: Record<string, unknown>,
  ctx: RpcContext,
) => Promise<unknown> | unknown;

const handlers = new Map<string, RpcHandler>();

export function registerRpcHandler(method: string, handler: RpcHandler): void {
  handlers.set(method, handler);
}

export function registerRpcAlias(alias: string, target: string): void {
  const handler = handlers.get(target);
  if (handler) {
    handlers.set(alias, handler);
  }
}

export function getRpcHandler(method: string): RpcHandler | undefined {
  return handlers.get(method);
}

export function hasRpcHandler(method: string): boolean {
  return handlers.has(method);
}

export function listRpcMethods(): string[] {
  return [...handlers.keys()];
}

export function clearRpcRegistryForTests(): void {
  handlers.clear();
}

/**
 * Dispatch an RPC call through the registry.
 * Returns the handler result or throws if the method is unknown.
 */
export async function dispatchRpc(
  method: string,
  params: Record<string, unknown>,
  ctx: RpcContext,
): Promise<unknown> {
  const handler = handlers.get(method);
  if (!handler) {
    throw new Error(`Unknown RPC method: ${method}`);
  }
  return handler(params, ctx);
}
