import type { ExecutionContext, ExecutionResult, ParsedPipeline } from "./types";
import { parsePipeline } from "./parser";
import { registry } from "./registry";
import { expandMacros } from "./macros";

/**
 * Execute a slash command input string.
 * Parses the input into a pipeline and runs each command in sequence.
 */
export async function executeSlashCommand(input: string, chatId: number): Promise<ExecutionResult> {
  const pipeline = parsePipeline(input);
  return executePipeline(pipeline, chatId);
}

/**
 * Execute a parsed pipeline of commands.
 */
export async function executePipeline(
  pipeline: ParsedPipeline,
  chatId: number,
  parentContext?: ExecutionContext,
): Promise<ExecutionResult> {
  const context: ExecutionContext = parentContext ?? {
    variables: new Map(),
    chatId,
    pipeValue: "",
    aborted: false,
  };

  let lastResult = "";
  let outputMode: ExecutionResult["outputMode"] = "none";

  for (const cmd of pipeline.commands) {
    if (context.aborted) break;

    const command = registry.get(cmd.name);
    if (!command) {
      return {
        result: "",
        outputMode: "none",
        error: `Unknown command: /${cmd.name}`,
      };
    }

    // Expand macros in args
    const expandedNamedArgs: Record<string, string> = {};
    for (const [key, value] of Object.entries(cmd.namedArgs)) {
      expandedNamedArgs[key] = expandMacros(value, context);
    }

    // Inject body block for control flow commands (/if, /while, /times)
    if (cmd.body) {
      expandedNamedArgs.__body = cmd.body;
    }

    // Pipe value: if unnamed args is empty, use the pipe value from previous command
    let unnamedArgs = expandMacros(cmd.unnamedArgs, context);
    if (!unnamedArgs && context.pipeValue) {
      unnamedArgs = context.pipeValue;
    }

    try {
      lastResult = await command.callback(expandedNamedArgs, unnamedArgs, context);
      context.pipeValue = lastResult;
      outputMode = resolveOutputMode(lastResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        result: "",
        outputMode: "none",
        error: `Error in /${cmd.name}: ${message}`,
      };
    }
  }

  return { result: lastResult, outputMode };
}

/**
 * Execute a body block string (used by /if, /while, /times).
 * The body is parsed as a new pipeline and executed in the same context.
 */
export async function executeBody(body: string, context: ExecutionContext): Promise<string> {
  // Body can be a pipeline (with or without leading /)
  const input = body.trim().startsWith("/") ? body.trim() : `/${body.trim()}`;
  const pipeline = parsePipeline(input);
  const result = await executePipeline(pipeline, context.chatId, context);
  if (result.error) throw new Error(result.error);
  return result.result;
}

function resolveOutputMode(result: string): ExecutionResult["outputMode"] {
  if (!result) return "none";
  if (result.startsWith("__")) return "none";
  return "display";
}
