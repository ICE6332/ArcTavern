import type { SlashCommand } from "../types";
import { characterApi, chatApi } from "@/lib/api";

export const charCommands: SlashCommand[] = [
  {
    name: "sendas",
    callback: async (args, unnamed, ctx) => {
      const name = args.name ?? "";
      const text = unnamed.trim();
      if (!name || !text || !ctx.chatId) return "";

      await chatApi.addMessage(ctx.chatId, {
        role: "assistant",
        name,
        content: text,
      });
      return "__refresh_chat__";
    },
    helpString: "Send a message as a specific character",
    aliases: [],
    returns: "The sent message",
    namedArgumentList: [
      { name: "name", description: "Character name to send as", isRequired: true },
    ],
    unnamedArgumentList: [{ description: "Message text", isRequired: true }],
  },
  {
    name: "sys",
    callback: async (_args, unnamed, ctx) => {
      const text = unnamed.trim();
      if (!text || !ctx.chatId) return "";

      await chatApi.addMessage(ctx.chatId, {
        role: "system",
        name: "System",
        content: text,
      });
      return "__refresh_chat__";
    },
    helpString: "Send a system message",
    aliases: ["system"],
    returns: "The sent message",
    namedArgumentList: [],
    unnamedArgumentList: [{ description: "System message text", isRequired: true }],
  },
  {
    name: "nar",
    callback: async (_args, unnamed, ctx) => {
      const text = unnamed.trim();
      if (!text || !ctx.chatId) return "";

      await chatApi.addMessage(ctx.chatId, {
        role: "system",
        name: "Narrator",
        content: text,
      });
      return "__refresh_chat__";
    },
    helpString: "Send a narrator/narration message",
    aliases: ["narrator"],
    returns: "The sent message",
    namedArgumentList: [],
    unnamedArgumentList: [{ description: "Narration text", isRequired: true }],
  },
  {
    name: "dupe",
    callback: async (args) => {
      const id = parseInt(args.id ?? "0", 10);
      if (!id) return "";

      const character = await characterApi.getOne(id);
      if (!character) return "";

      const created = await characterApi.create({
        name: `${character.name} (copy)`,
        description: character.description,
        personality: character.personality,
        firstMes: character.firstMes,
        mesExample: character.mesExample,
        scenario: character.scenario,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
        creatorNotes: character.creatorNotes,
        tags: character.tags,
      });
      return String(created?.id ?? "");
    },
    helpString: "Duplicate a character",
    aliases: [],
    returns: "New character ID",
    namedArgumentList: [{ name: "id", description: "Character ID to duplicate", isRequired: true }],
    unnamedArgumentList: [],
  },
  {
    name: "char-find",
    callback: async (args) => {
      const name = args.name ?? "";
      const characters = await characterApi.getAll();
      const matches = characters.filter((c) => {
        if (name && !c.name.toLowerCase().includes(name.toLowerCase())) return false;
        return true;
      });
      if (matches.length === 0) return "";
      return matches.map((c) => `${c.id}: ${c.name}`).join("\n");
    },
    helpString: "Find characters by name",
    aliases: [],
    returns: "List of matching characters",
    namedArgumentList: [
      { name: "name", description: "Name to search for", isRequired: false },
      { name: "tag", description: "Tag to filter by", isRequired: false },
    ],
    unnamedArgumentList: [],
  },
];
