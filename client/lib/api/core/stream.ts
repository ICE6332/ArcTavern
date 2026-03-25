import { jsonSchema, parseJsonEventStream } from "ai";

export type StreamChunk = {
  content?: string;
  reasoning?: string;
  error?: string;
  structured?: unknown;
};

export type GroupStreamChunk = StreamChunk & {
  speaker?: string;
  speakerId?: number;
};

const streamChunkSchema = jsonSchema<StreamChunk & { speaker?: string; speakerId?: number }>({
  type: "object",
  properties: {
    content: { type: "string" },
    reasoning: { type: "string" },
    error: { type: "string" },
    speaker: { type: "string" },
    speakerId: { type: "number" },
  },
  additionalProperties: true,
});

export async function* readSSE<T extends StreamChunk = StreamChunk>(
  url: string,
  options: RequestInit,
  signal?: AbortSignal,
): AsyncGenerator<T, void, unknown> {
  const res = await fetch(url, { ...options, signal });

  if (!res.ok) {
    let details = "";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const message =
            (typeof parsed.message === "string" && parsed.message) ||
            (typeof parsed.error === "string" && parsed.error) ||
            raw;
          details = ` - ${message}`;
        } catch {
          details = ` - ${raw}`;
        }
      }
    } catch {
      // Ignore response parsing failure and keep status-only error.
    }

    throw new Error(`Stream error: ${res.status}${details}`);
  }

  if (!res.body) {
    throw new Error("No response body");
  }

  const parsed = parseJsonEventStream({
    stream: res.body,
    schema: streamChunkSchema,
  });
  const reader = parsed.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value.success) {
        throw value.error;
      }

      yield value.value as T;
    }
  } finally {
    reader.releaseLock();
  }
}
