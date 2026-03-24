import type { ExecutionContext } from "./types"
import { getVariable, setVariable, addToVariable } from "./variables"
import { useVariableStore } from "@/stores/variable-store"

/**
 * Expand all {{...}} macros in a string.
 *
 * Supported macros:
 *   - {{char}}, {{user}} — character/user name
 *   - {{time}}, {{date}}, {{datetime}} — current date/time
 *   - {{random::min::max}} — random integer
 *   - {{idle_duration}} — seconds since last message
 *   - {{lastMessage}} — last message content
 *   - {{getvar::name}} — get variable (exec → local → global)
 *   - {{setvar::name::value}} — set local variable, returns value
 *   - {{getglobalvar::name}} — get global variable
 *   - {{setglobalvar::name::value}} — set global variable
 *   - {{addvar::name::value}}, {{addglobalvar::name::value}}
 *   - {{incvar::name}}, {{decvar::name}}
 *   - {{incglobalvar::name}}, {{decglobalvar::name}}
 */
export function expandMacros(
  text: string,
  context: ExecutionContext,
): string {
  if (!text || !text.includes("{{")) return text

  return text.replace(/\{\{([^}]+)\}\}/g, (match, inner: string) => {
    const parts = inner.split("::")
    const macroName = parts[0].trim().toLowerCase()

    try {
      return resolveMacro(macroName, parts.slice(1), context) ?? match
    } catch {
      return match
    }
  })
}

function resolveMacro(
  name: string,
  args: string[],
  context: ExecutionContext,
): string | undefined {
  switch (name) {
    // --- Built-in macros ---
    case "char":
      return getCharName()
    case "user":
      return getUserName()
    case "time":
      return new Date().toLocaleTimeString()
    case "date":
      return new Date().toLocaleDateString()
    case "datetime":
      return new Date().toLocaleString()
    case "random": {
      const min = parseInt(args[0] ?? "0", 10)
      const max = parseInt(args[1] ?? "100", 10)
      return String(Math.floor(Math.random() * (max - min + 1)) + min)
    }
    case "idle_duration":
      return "0" // TODO: implement with last message timestamp
    case "lastmessage":
      return "" // TODO: implement with chat store

    // --- Variable macros ---
    case "getvar":
      return getVariable(args[0] ?? "", context) ?? ""
    case "setvar": {
      const val = args[1] ?? ""
      setVariable("local", args[0] ?? "", val, context)
      return val
    }
    case "getglobalvar": {
      const store = useVariableStore.getState()
      return store.globalVariables[args[0] ?? ""] ?? ""
    }
    case "setglobalvar": {
      const val = args[1] ?? ""
      setVariable("global", args[0] ?? "", val, context)
      return val
    }
    case "addvar":
      return addToVariable("local", args[0] ?? "", args[1] ?? "0", context)
    case "addglobalvar":
      return addToVariable("global", args[0] ?? "", args[1] ?? "0", context)
    case "incvar":
      return addToVariable("local", args[0] ?? "", "1", context)
    case "decvar":
      return addToVariable("local", args[0] ?? "", "-1", context)
    case "incglobalvar":
      return addToVariable("global", args[0] ?? "", "1", context)
    case "decglobalvar":
      return addToVariable("global", args[0] ?? "", "-1", context)

    default:
      return undefined
  }
}

function getCharName(): string {
  // Access character store without React hooks (direct state access)
  try {
    // Dynamic import to avoid circular dependency at module level
    const stores = (globalThis as Record<string, unknown>).__arctavern_stores as
      | { characterName?: string; userName?: string }
      | undefined
    return stores?.characterName ?? "Character"
  } catch {
    return "Character"
  }
}

function getUserName(): string {
  try {
    const stores = (globalThis as Record<string, unknown>).__arctavern_stores as
      | { characterName?: string; userName?: string }
      | undefined
    return stores?.userName ?? "User"
  } catch {
    return "User"
  }
}

/**
 * Register store references for macro access.
 * Call this once during app initialization.
 */
export function registerMacroStores(stores: {
  characterName: string
  userName: string
}): void {
  ;(globalThis as Record<string, unknown>).__arctavern_stores = stores
}
