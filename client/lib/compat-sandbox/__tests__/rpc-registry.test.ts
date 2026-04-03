import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../rpc-handlers/context", () => ({
  getContext: vi.fn(),
  getVariables: vi.fn(),
  requestWriteDone: vi.fn(),
  getVariable: vi.fn(),
  setVariable: vi.fn(),
}));

vi.mock("../rpc-handlers/commands", () => ({
  runSlashCommand: vi.fn(),
}));

vi.mock("../rpc-handlers/messages", () => ({
  getChatMessages: vi.fn(),
  getLastMessage: vi.fn(),
  getMessage: vi.fn(),
  getLastMessageId: vi.fn(),
  editMessage: vi.fn(),
  deleteMessageHandler: vi.fn(),
  addMessage: vi.fn(),
  getMessageCount: vi.fn(),
}));

vi.mock("../rpc-handlers/characters", () => ({
  getCharacter: vi.fn(),
  getCharacterList: vi.fn(),
  getCurrentCharacterName: vi.fn(),
  getCharacterAvatarUrl: vi.fn(),
}));

vi.mock("../rpc-handlers/generation", () => ({
  isGenerating: vi.fn(),
  stopGeneration: vi.fn(),
  generate: vi.fn(),
  getGenerationType: vi.fn(),
  getStreamingContent: vi.fn(),
}));

vi.mock("../rpc-handlers/connection", () => ({
  getConnectionSettings: vi.fn(),
  getProvider: vi.fn(),
  getModel: vi.fn(),
}));

vi.mock("../rpc-handlers/worldinfo", () => ({
  getWorldInfoBooks: vi.fn(),
  getWorldInfoEntries: vi.fn(),
  getActiveWorldInfoBookIds: vi.fn(),
}));

vi.mock("../rpc-handlers/globals", () => ({
  initializeGlobal: vi.fn(),
  waitGlobalInitialized: vi.fn(),
  getGlobal: vi.fn(),
}));
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
  builtinRpcAliasEntries,
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

    for (const [alias] of builtinRpcAliasEntries) {
      expect(methods).toContain(alias);
    }

    expect(methods).toHaveLength(builtinRpcHandlerEntries.length + builtinRpcAliasEntries.length);
  });

  it("registers representative compat aliases", async () => {
    registerBuiltinHandlers();

    expect(getRpcHandler("triggerSlash")).toBe(getRpcHandler("runSlashCommand"));
    expect(getRpcHandler("getCharacterNames")).toBe(getRpcHandler("getCharacterList"));
    expect(getRpcHandler("getCharData")).toBe(getRpcHandler("getCharacter"));
    expect(getRpcHandler("stopAllGeneration")).toBe(getRpcHandler("stopGeneration"));
  });
});
