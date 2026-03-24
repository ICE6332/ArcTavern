import type { SlashCommand } from "../types"
import {
  getVariable,
  setVariable,
  deleteVariable,
  incrementVariable,
  decrementVariable,
  addToVariable,
  listVariables,
} from "../variables"

export const varCommands: SlashCommand[] = [
  {
    name: "let",
    callback: (args, unnamed, ctx) => {
      const name = args.key ?? ""
      if (!name) return ""
      const value = unnamed || args.value || ""
      ctx.variables.set(name, value)
      return value
    },
    helpString: "Declare an execution-scope variable",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
      { name: "value", description: "Variable value", isRequired: false },
    ],
    unnamedArgumentList: [
      { description: "Variable value (alternative to named value=)", isRequired: false },
    ],
  },
  {
    name: "var",
    callback: (args, unnamed, ctx) => {
      const name = args.key ?? ""
      if (!name) return ""
      if (unnamed) {
        ctx.variables.set(name, unnamed)
        return unnamed
      }
      return getVariable(name, ctx) ?? ""
    },
    helpString: "Get or set an execution-scope variable",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [
      { description: "Value to set (omit to get)", isRequired: false },
    ],
  },
  {
    name: "setvar",
    callback: (args, unnamed, ctx) => {
      const name = args.key ?? ""
      if (!name) return ""
      const value = unnamed || ""
      setVariable("local", name, value, ctx)
      return value
    },
    helpString: "Set a chat-local variable",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [
      { description: "Variable value", isRequired: false },
    ],
  },
  {
    name: "getvar",
    callback: (args, _unnamed, ctx) => {
      const name = args.key ?? ""
      return getVariable(name, ctx) ?? ""
    },
    helpString: "Get a variable (checks exec → local → global)",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "setglobalvar",
    callback: (args, unnamed, ctx) => {
      const name = args.key ?? ""
      if (!name) return ""
      const value = unnamed || ""
      setVariable("global", name, value, ctx)
      return value
    },
    helpString: "Set a global variable",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [
      { description: "Variable value", isRequired: false },
    ],
  },
  {
    name: "getglobalvar",
    callback: (args, _unnamed, ctx) => {
      const name = args.key ?? ""
      return getVariable(name, ctx) ?? ""
    },
    helpString: "Get a global variable",
    aliases: [],
    returns: "The variable value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "addvar",
    callback: (args, unnamed, ctx) => {
      const name = args.key ?? ""
      return addToVariable("local", name, unnamed || "0", ctx)
    },
    helpString: "Add a numeric value to a chat-local variable",
    aliases: [],
    returns: "The new value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [
      { description: "Value to add", isRequired: true },
    ],
  },
  {
    name: "incvar",
    callback: (args, _unnamed, ctx) => {
      return incrementVariable("local", args.key ?? "", ctx)
    },
    helpString: "Increment a chat-local variable by 1",
    aliases: [],
    returns: "The new value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "decvar",
    callback: (args, _unnamed, ctx) => {
      return decrementVariable("local", args.key ?? "", ctx)
    },
    helpString: "Decrement a chat-local variable by 1",
    aliases: [],
    returns: "The new value",
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "flushvar",
    callback: (args) => {
      const name = args.key ?? ""
      if (name) deleteVariable("local", name)
      return ""
    },
    helpString: "Delete a chat-local variable",
    aliases: [],
    namedArgumentList: [
      { name: "key", description: "Variable name", isRequired: true },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "listvar",
    callback: (args) => {
      const scope = (args.scope as "all" | "local" | "global") || "all"
      const vars = listVariables(scope)
      const entries = Object.entries(vars)
      if (entries.length === 0) return "(no variables)"
      return entries.map(([k, v]) => `${k} = ${v}`).join("\n")
    },
    helpString: "List all variables",
    aliases: [],
    returns: "Variable list",
    namedArgumentList: [
      {
        name: "scope",
        description: "Scope filter",
        isRequired: false,
        defaultValue: "all",
        enumList: ["all", "local", "global"],
      },
    ],
    unnamedArgumentList: [],
  },
]
