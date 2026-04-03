export interface CompatBridgeData {
  statWithoutMeta?: unknown;
  variableInsert?: unknown;
  eraData?: unknown;
}

export type AssistantRenderSegment =
  | { type: "markdown"; content: string }
  | { type: "widget"; html: string };

const COMPAT_DATA_BLOCK_RE =
  /<(variableinsert|variableedit|variabledelete|era_data)>\s*([\s\S]*?)\s*<\/\1>/gi;

const FENCED_BLOCK_RE = /```(?:html)?\s*([\s\S]*?)```/gi;
const RAW_DOCUMENT_RE =
  /(?:<!DOCTYPE\s+html[\s\S]*?<\/html>)|(?:<html[\s\S]*?<\/html>)|(?:<body[\s\S]*?<\/body>)/gi;

function tryParseStructuredValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function looksLikeWidgetDocument(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  return (
    /^(?:<!DOCTYPE\s+html\b|<html\b|<body\b)/i.test(trimmed) ||
    (/<(?:style|script|head|meta|link)\b/i.test(trimmed) &&
      /<(?:div|section|main|body)\b/i.test(trimmed))
  );
}

function splitByPattern(
  input: AssistantRenderSegment[],
  pattern: RegExp,
  mapper: (match: RegExpExecArray) => AssistantRenderSegment | null,
): AssistantRenderSegment[] {
  return input.flatMap((segment) => {
    if (segment.type !== "markdown" || !segment.content) {
      return [segment];
    }

    const parts: AssistantRenderSegment[] = [];
    let lastIndex = 0;
    pattern.lastIndex = 0;

    for (let match = pattern.exec(segment.content); match; match = pattern.exec(segment.content)) {
      if (match.index > lastIndex) {
        parts.push({
          type: "markdown",
          content: segment.content.slice(lastIndex, match.index),
        });
      }

      const mapped = mapper(match);
      if (mapped) {
        parts.push(mapped);
      } else {
        parts.push({
          type: "markdown",
          content: match[0],
        });
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < segment.content.length) {
      parts.push({
        type: "markdown",
        content: segment.content.slice(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [segment];
  });
}

function normalizeSegments(segments: AssistantRenderSegment[]): AssistantRenderSegment[] {
  const merged: AssistantRenderSegment[] = [];

  for (const segment of segments) {
    if (segment.type === "markdown") {
      if (!segment.content) continue;

      const prev = merged[merged.length - 1];
      if (prev?.type === "markdown") {
        prev.content += segment.content;
      } else {
        merged.push({ ...segment });
      }
      continue;
    }

    merged.push(segment);
  }

  return merged.filter((segment) => segment.type === "widget" || segment.content.trim().length > 0);
}

export function extractCompatBridgeData(rawContent: string): CompatBridgeData {
  if (!rawContent) return {};

  const data: CompatBridgeData = {};

  for (
    let match = COMPAT_DATA_BLOCK_RE.exec(rawContent);
    match;
    match = COMPAT_DATA_BLOCK_RE.exec(rawContent)
  ) {
    const key = match[1].toLowerCase();
    const value = tryParseStructuredValue(match[2] ?? "");

    if (key === "variableinsert") {
      data.variableInsert = value;
      if (data.statWithoutMeta === undefined) {
        data.statWithoutMeta = value;
      }
    } else if (key === "era_data") {
      data.eraData = value;
    }
  }

  return data;
}

export function extractAssistantRenderSegments(content: string): AssistantRenderSegment[] {
  if (!content) return [];

  let segments: AssistantRenderSegment[] = [{ type: "markdown", content }];

  segments = splitByPattern(segments, FENCED_BLOCK_RE, (match) => {
    const inner = (match[1] ?? "").trim();
    if (!looksLikeWidgetDocument(inner)) return null;
    return { type: "widget", html: inner };
  });

  segments = splitByPattern(segments, RAW_DOCUMENT_RE, (match) => {
    const html = match[0].trim();
    if (!looksLikeWidgetDocument(html)) return null;
    return { type: "widget", html };
  });

  return normalizeSegments(segments);
}
