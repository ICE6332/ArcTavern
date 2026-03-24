import type { SlashCommand } from "../types"

/**
 * Generation commands interact with the chat store.
 * They return special sentinel values that the UI integration layer handles.
 */
export const genCommands: SlashCommand[] = [
  {
    name: "gen",
    callback: (_args, unnamed) => {
      // The UI integration layer will intercept this and call sendMessage
      return `__gen__:${unnamed}`
    },
    helpString: "Trigger AI generation with an optional prompt",
    aliases: ["generate"],
    returns: "Generated text",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "Prompt text (optional)", isRequired: false },
    ],
  },
  {
    name: "impersonate",
    callback: (_args, unnamed) => {
      return `__impersonate__:${unnamed}`
    },
    helpString: "Generate a message as the user character",
    aliases: [],
    returns: "Generated text",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "Prompt text (optional)", isRequired: false },
    ],
  },
  {
    name: "continue",
    callback: () => {
      return "__continue__"
    },
    helpString: "Continue the last AI generation",
    aliases: [],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
  {
    name: "stop",
    callback: () => {
      return "__stop__"
    },
    helpString: "Stop the current AI generation",
    aliases: ["abort"],
    namedArgumentList: [],
    unnamedArgumentList: [],
  },
]
