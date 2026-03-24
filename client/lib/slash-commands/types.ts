export interface SlashCommandArgument {
  description: string
  isRequired: boolean
  defaultValue?: string
  enumList?: string[]
}

export interface SlashCommandNamedArgument extends SlashCommandArgument {
  name: string
}

export interface SlashCommand {
  name: string
  callback: (
    namedArgs: Record<string, string>,
    unnamedArgs: string,
    context: ExecutionContext,
  ) => string | Promise<string>
  helpString: string
  aliases: string[]
  returns?: string
  namedArgumentList: SlashCommandNamedArgument[]
  unnamedArgumentList: SlashCommandArgument[]
}

export interface ExecutionContext {
  /** Per-pipeline execution scope variables */
  variables: Map<string, string>
  chatId: number
  /** Pipe value from previous command in the pipeline */
  pipeValue: string
  /** Signal to abort execution */
  aborted: boolean
}

export interface ParsedCommand {
  name: string
  namedArgs: Record<string, string>
  unnamedArgs: string
  /** Body block content for control flow commands like /if, /while, /times */
  body?: string
}

export interface ParsedPipeline {
  commands: ParsedCommand[]
}

export interface ExecutionResult {
  /** Final result string from the last command */
  result: string
  /** Whether the result should be sent as a chat message */
  shouldSendMessage: boolean
  /** Error message if execution failed */
  error?: string
}
