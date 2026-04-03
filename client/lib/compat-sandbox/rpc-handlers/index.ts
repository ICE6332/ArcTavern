/**
 * Registers all built-in RPC handlers with the global registry.
 * Call once at application startup (or sandbox panel mount).
 */

import type { RpcHandler } from "../rpc-registry";
import { registerRpcAlias, registerRpcHandler } from "../rpc-registry";
import { getContext, getVariables, requestWriteDone, getVariable, setVariable } from "./context";
import { runSlashCommand } from "./commands";
import {
  getChatMessages,
  getLastMessage,
  getMessage,
  getLastMessageId,
  editMessage,
  deleteMessageHandler,
  addMessage,
  getMessageCount,
} from "./messages";
import {
  getCharacter,
  getCharacterList,
  getCurrentCharacterName,
  getCharacterAvatarUrl,
} from "./characters";
import {
  isGenerating,
  stopGeneration,
  generate,
  getGenerationType,
  getStreamingContent,
} from "./generation";
import { getConnectionSettings, getProvider, getModel } from "./connection";
import { getWorldInfoBooks, getWorldInfoEntries, getActiveWorldInfoBookIds } from "./worldinfo";
import { initializeGlobal, waitGlobalInitialized, getGlobal } from "./globals";

let registered = false;

export const builtinRpcHandlerEntries: ReadonlyArray<readonly [string, RpcHandler]> = [
  ["getContext", getContext],
  ["getVariables", getVariables],
  ["requestWriteDone", requestWriteDone],
  ["getVariable", getVariable],
  ["setVariable", setVariable],
  ["runSlashCommand", runSlashCommand],
  ["getChatMessages", getChatMessages],
  ["getLastMessage", getLastMessage],
  ["getMessage", getMessage],
  ["getLastMessageId", getLastMessageId],
  ["editMessage", editMessage],
  ["deleteMessage", deleteMessageHandler],
  ["addMessage", addMessage],
  ["getMessageCount", getMessageCount],
  ["getCharacter", getCharacter],
  ["getCharacterList", getCharacterList],
  ["getCurrentCharacterName", getCurrentCharacterName],
  ["getCharacterAvatarUrl", getCharacterAvatarUrl],
  ["isGenerating", isGenerating],
  ["stopGeneration", stopGeneration],
  ["generate", generate],
  ["getGenerationType", getGenerationType],
  ["getStreamingContent", getStreamingContent],
  ["getConnectionSettings", getConnectionSettings],
  ["getProvider", getProvider],
  ["getModel", getModel],
  ["getWorldInfoBooks", getWorldInfoBooks],
  ["getWorldInfoEntries", getWorldInfoEntries],
  ["getActiveWorldInfoBookIds", getActiveWorldInfoBookIds],
  ["initializeGlobal", initializeGlobal],
  ["waitGlobalInitialized", waitGlobalInitialized],
  ["getGlobal", getGlobal],
] as const;

export const builtinRpcAliasEntries: ReadonlyArray<readonly [string, string]> = [
  ["triggerSlash", "runSlashCommand"],
  ["getCharacterNames", "getCharacterList"],
  ["getCharData", "getCharacter"],
  ["deleteChatMessages", "deleteMessage"],
  ["setChatMessage", "editMessage"],
  ["createChatMessages", "addMessage"],
  ["getModelList", "getModel"],
  ["stopAllGeneration", "stopGeneration"],
] as const;

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
