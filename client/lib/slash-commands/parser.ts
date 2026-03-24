import type { ParsedCommand, ParsedPipeline } from "./types";

/**
 * Parse a slash command input string into a pipeline of commands.
 *
 * Syntax:
 *   /commandName key1=value1 key2="quoted value" unnamed args | /nextCommand
 *
 * Supports:
 *   - Named args: key=value or key="value with spaces"
 *   - Unnamed args: everything after named args
 *   - Pipe chains: commands separated by |
 *   - Body blocks: { ... } for control flow (/if, /while, /times)
 */
export function parsePipeline(input: string): ParsedPipeline {
  const segments = splitPipeline(input);
  const commands = segments.map(parseCommand).filter(Boolean) as ParsedCommand[];
  return { commands };
}

/**
 * Split input by unquoted, un-braced pipe characters.
 */
function splitPipeline(input: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let braceDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : "";

    if (ch === '"' && !inSingleQuote && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }
    if (ch === "'" && !inDoubleQuote && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (!inDoubleQuote && !inSingleQuote) {
      if (ch === "{") {
        braceDepth++;
        current += ch;
        continue;
      }
      if (ch === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        current += ch;
        continue;
      }
      if (ch === "|" && braceDepth === 0) {
        segments.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
}

/**
 * Parse a single command segment into name, named args, unnamed args, and optional body.
 */
function parseCommand(segment: string): ParsedCommand | null {
  let s = segment.trim();
  if (!s.startsWith("/")) return null;

  // Remove leading slash
  s = s.slice(1);

  // Extract command name (first word)
  const nameMatch = s.match(/^([\w?-]+)/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  let rest = s.slice(name.length).trim();

  // Extract body block { ... } if present
  let body: string | undefined;
  const bodyStart = findBodyStart(rest);
  if (bodyStart !== -1) {
    const bodyContent = extractBody(rest, bodyStart);
    if (bodyContent !== null) {
      body = bodyContent.content;
      rest = rest.slice(0, bodyStart).trim();
    }
  }

  // Parse named and unnamed args from the rest
  const { namedArgs, unnamedArgs } = parseArgs(rest);

  return { name, namedArgs, unnamedArgs, body };
}

/**
 * Find the start index of a body block { ... } in the string.
 */
function findBodyStart(s: string): number {
  let inDoubleQuote = false;
  let inSingleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";

    if (ch === '"' && !inSingleQuote && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (ch === "'" && !inDoubleQuote && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === "{" && !inDoubleQuote && !inSingleQuote) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract body content between balanced { ... } braces.
 */
function extractBody(s: string, start: number): { content: string; end: number } | null {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    if (s[i] === "}") {
      depth--;
      if (depth === 0) {
        return {
          content: s.slice(start + 1, i).trim(),
          end: i,
        };
      }
    }
  }
  return null;
}

/**
 * Parse named args (key=value or key="value") and collect remaining as unnamed args.
 */
function parseArgs(s: string): {
  namedArgs: Record<string, string>;
  unnamedArgs: string;
} {
  const namedArgs: Record<string, string> = {};
  const tokens = tokenize(s);
  const unnamedParts: string[] = [];

  for (const token of tokens) {
    const eqIdx = token.indexOf("=");
    if (eqIdx > 0 && /^[\w-]+$/.test(token.slice(0, eqIdx))) {
      const key = token.slice(0, eqIdx);
      let value = token.slice(eqIdx + 1);
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      namedArgs[key] = value;
    } else {
      unnamedParts.push(token);
    }
  }

  return { namedArgs, unnamedArgs: unnamedParts.join(" ") };
}

/**
 * Tokenize a string respecting quotes.
 * "key=value", 'key=value', key=value, and bare words are all tokens.
 */
function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";

    if (ch === '"' && !inSingleQuote && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }
    if (ch === "'" && !inDoubleQuote && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === " " && !inDoubleQuote && !inSingleQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check if a string looks like a slash command (starts with /).
 */
export function isSlashCommand(input: string): boolean {
  return /^\/[\w?]/.test(input.trim());
}
