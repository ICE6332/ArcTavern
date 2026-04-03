/**
 * RPC handler: slash command execution.
 */

import { executeSlashCommand } from "@/lib/slash-commands/executor";
import type { RpcHandler } from "../rpc-registry";

export const runSlashCommand: RpcHandler = async (params, ctx) => {
  const command = typeof params.command === "string" ? params.command : "";
  if (!command || ctx.chatId == null) return false;

  await executeSlashCommand(command, ctx.chatId);
  return true;
};
