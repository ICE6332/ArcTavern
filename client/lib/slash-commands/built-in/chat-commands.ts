import type { SlashCommand } from "../types";
import { chatApi } from "@/lib/api";

export const chatCommands: SlashCommand[] = [
  {
    name: "delchat",
    callback: () => {
      return "__delete_chat__";
    },
    helpString: "Delete the current chat",
    aliases: [],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
  {
    name: "renamechat",
    callback: (_args, unnamed) => {
      // TODO: Needs chatApi.update endpoint for title
      const newName = unnamed.trim();
      if (!newName) return "";
      return `__renamechat__:${newName}`;
    },
    helpString: "Rename the current chat",
    aliases: [],
    returns: "The new chat name",
    namedArgumentList: [],
    unnamedArgumentList: [{ description: "New chat name", isRequired: true }],
  },
  {
    name: "getchatname",
    callback: async (_args, _unnamed, ctx) => {
      if (!ctx.chatId) return "";
      const chat = await chatApi.getOne(ctx.chatId);
      return chat?.name ?? "";
    },
    helpString: "Get the current chat name",
    aliases: [],
    returns: "Chat name",
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
  {
    name: "closechat",
    callback: () => {
      // This will be handled by the UI integration layer
      // Setting a flag that the chat panel can react to
      return "__closechat__";
    },
    helpString: "Close the current chat",
    aliases: [],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
  {
    name: "tempchat",
    callback: () => {
      // Handled by UI integration - creates a new temp chat
      return "__tempchat__";
    },
    helpString: "Open a temporary chat",
    aliases: [],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
];
