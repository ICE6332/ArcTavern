/**
 * Incremental JSON parser for streaming structured output.
 * Attempts to parse partial JSON by repairing unclosed brackets/braces.
 */

export function tryParsePartialJson(text: string): unknown | null {
  let trimmed = text.trim();
  if (!trimmed) return null;

  // Strip markdown code fence wrapper (```json ... ``` or ``` ... ```)
  trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  trimmed = trimmed.trim();
  if (!trimmed) return null;

  // Try direct parse first (complete JSON)
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to repair
  }

  // Strip trailing comma before repair
  const cleaned = trimmed.replace(/,\s*$/, '');

  // Attempt to repair by closing unclosed brackets/braces
  const repaired = repairJson(cleaned);
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function repairJson(text: string): string {
  const closers: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') closers.pop();
  }

  // If we're in an unclosed string, close it
  let result = text;
  if (inString) {
    result += '"';
  }

  // Strip trailing comma after closing string
  result = result.replace(/,\s*$/, '');

  // Close all unclosed brackets/braces in reverse order
  while (closers.length > 0) {
    result += closers.pop();
  }

  return result;
}
