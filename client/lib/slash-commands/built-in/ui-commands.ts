import type { SlashCommand } from "../types";
import { registry } from "../registry";

export const uiCommands: SlashCommand[] = [
  {
    name: "echo",
    callback: (_args, unnamed) => {
      // Returns a sentinel that the UI layer intercepts to show a local message
      return `__echo__:${unnamed}`;
    },
    helpString: "Display text in chat without sending (does not trigger AI)",
    aliases: [],
    returns: "The displayed text",
    namedArgumentList: [],
    unnamedArgumentList: [{ description: "Text to display", isRequired: true }],
  },
  {
    name: "help",
    callback: (_args, unnamed) => {
      const topic = unnamed.trim();
      return registry.getHelp(topic || undefined);
    },
    helpString: "Show help for all commands or a specific command",
    aliases: ["?"],
    returns: "Help text",
    namedArgumentList: [],
    unnamedArgumentList: [{ description: "Command name (optional)", isRequired: false }],
  },
  {
    name: "panels",
    callback: () => {
      return "__panels__";
    },
    helpString: "Toggle sidebar panels",
    aliases: [],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
];
