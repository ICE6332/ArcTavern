import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRpcRegistryForTests,
  registerRpcHandler,
  registerRpcAlias,
  getRpcHandler,
  hasRpcHandler,
  dispatchRpc,
  listRpcMethods,
  type RpcContext,
} from "../rpc-registry";
import {
  builtinRpcHandlerEntries,
  registerBuiltinHandlers,
  resetBuiltinHandlersForTests,
} from "../rpc-handlers";

const stubCtx: RpcContext = {
  chatId: 1,
  characterId: 2,
  extras: {},
};

describe("rpc-registry", () => {
  beforeEach(() => {
    clearRpcRegistryForTests();
    resetBuiltinHandlersForTests();
  });

  it("registers and retrieves a handler", () => {
    registerRpcHandler("test:echo", (params) => params.value);
    expect(hasRpcHandler("test:echo")).toBe(true);
    expect(getRpcHandler("test:echo")).toBeDefined();
  });

  it("dispatches to a registered handler", async () => {
    registerRpcHandler("test:add", (params) => {
      return (Number(params.a) || 0) + (Number(params.b) || 0);
    });
    const result = await dispatchRpc("test:add", { a: 3, b: 4 }, stubCtx);
    expect(result).toBe(7);
  });

  it("throws for unknown method", async () => {
    await expect(dispatchRpc("test:nonexistent", {}, stubCtx)).rejects.toThrow(
      "Unknown RPC method: test:nonexistent",
    );
  });

  it("registers aliases", async () => {
    registerRpcHandler("test:original", () => "original");
    registerRpcAlias("test:alias", "test:original");
    const result = await dispatchRpc("test:alias", {}, stubCtx);
    expect(result).toBe("original");
  });

  it("lists registered methods", () => {
    registerRpcHandler("test:listed", () => null);
    const methods = listRpcMethods();
    expect(methods).toContain("test:listed");
  });

  it("passes context to handler", async () => {
    registerRpcHandler("test:ctx", (_params, ctx) => ctx.chatId);
    const result = await dispatchRpc("test:ctx", {}, { ...stubCtx, chatId: 42 });
    expect(result).toBe(42);
  });

  it("registers builtin canonical methods exactly once", () => {
    registerBuiltinHandlers();
    registerBuiltinHandlers();

    const methods = listRpcMethods();

    for (const [method] of builtinRpcHandlerEntries) {
      expect(methods).toContain(method);
    }

    expect(methods).toHaveLength(builtinRpcHandlerEntries.length);
  });

  it("dispatches builtins after registration", async () => {
    registerBuiltinHandlers();

    await expect(dispatchRpc("getContext", {}, stubCtx)).resolves.toEqual(
      expect.objectContaining({
        chatId: stubCtx.chatId,
        characterId: stubCtx.characterId,
      }),
    );
  });
});
