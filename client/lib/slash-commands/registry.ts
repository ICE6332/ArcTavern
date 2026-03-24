import type { SlashCommand } from "./types"

class SlashCommandRegistry {
  private commands = new Map<string, SlashCommand>()
  private aliases = new Map<string, string>()

  register(command: SlashCommand): void {
    this.commands.set(command.name, command)
    for (const alias of command.aliases) {
      this.aliases.set(alias, command.name)
    }
  }

  unregister(name: string): void {
    const cmd = this.commands.get(name)
    if (cmd) {
      for (const alias of cmd.aliases) {
        this.aliases.delete(alias)
      }
      this.commands.delete(name)
    }
  }

  get(nameOrAlias: string): SlashCommand | undefined {
    const resolved = this.aliases.get(nameOrAlias) ?? nameOrAlias
    return this.commands.get(resolved)
  }

  getAll(): SlashCommand[] {
    return Array.from(this.commands.values())
  }

  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined
  }

  /**
   * Get command completions matching a partial name.
   * Used by the autocomplete system.
   */
  getCompletions(partial: string): SlashCommand[] {
    const lower = partial.toLowerCase()
    const results: SlashCommand[] = []
    const seen = new Set<string>()

    for (const cmd of this.commands.values()) {
      if (seen.has(cmd.name)) continue

      const matches =
        cmd.name.toLowerCase().includes(lower) ||
        cmd.aliases.some((a) => a.toLowerCase().includes(lower))

      if (matches) {
        results.push(cmd)
        seen.add(cmd.name)
      }
    }

    // Sort: exact prefix matches first, then alphabetical
    return results.sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(lower) ? 0 : 1
      const bStartsWith = b.name.toLowerCase().startsWith(lower) ? 0 : 1
      if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Generate help text for all commands or a specific command.
   */
  getHelp(commandName?: string): string {
    if (commandName) {
      const cmd = this.get(commandName)
      if (!cmd) return `Unknown command: /${commandName}`
      return formatCommandHelp(cmd)
    }

    const grouped = new Map<string, SlashCommand[]>()
    for (const cmd of this.commands.values()) {
      // Group by first word of help string or "Other"
      const category = cmd.helpString.split(":")[0]?.trim() || "Other"
      const list = grouped.get(category) ?? []
      list.push(cmd)
      grouped.set(category, list)
    }

    const lines: string[] = ["Available commands:\n"]
    for (const [, cmds] of grouped) {
      for (const cmd of cmds) {
        const aliases =
          cmd.aliases.length > 0 ? ` (${cmd.aliases.map((a) => `/${a}`).join(", ")})` : ""
        lines.push(`  /${cmd.name}${aliases} — ${cmd.helpString}`)
      }
    }
    return lines.join("\n")
  }
}

function formatCommandHelp(cmd: SlashCommand): string {
  const lines: string[] = [`/${cmd.name} — ${cmd.helpString}`]

  if (cmd.aliases.length > 0) {
    lines.push(`Aliases: ${cmd.aliases.map((a) => `/${a}`).join(", ")}`)
  }

  if (cmd.namedArgumentList.length > 0) {
    lines.push("Named arguments:")
    for (const arg of cmd.namedArgumentList) {
      const req = arg.isRequired ? " (required)" : ""
      const def = arg.defaultValue ? ` [default: ${arg.defaultValue}]` : ""
      lines.push(`  ${arg.name}=${arg.description}${req}${def}`)
    }
  }

  if (cmd.unnamedArgumentList.length > 0) {
    lines.push("Arguments:")
    for (const arg of cmd.unnamedArgumentList) {
      const req = arg.isRequired ? " (required)" : ""
      lines.push(`  ${arg.description}${req}`)
    }
  }

  if (cmd.returns) {
    lines.push(`Returns: ${cmd.returns}`)
  }

  return lines.join("\n")
}

/** Global singleton registry */
export const registry = new SlashCommandRegistry()
