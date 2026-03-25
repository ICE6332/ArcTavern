import { describe, expect, it } from "vitest";
import { mapMessage, parseStructuredMessageContent } from "./chat";

describe("parseStructuredMessageContent", () => {
  it("parses structured response objects", () => {
    expect(
      parseStructuredMessageContent(
        JSON.stringify({ blocks: [{ role: "narration", text: "Hello" }] }),
        { format: "structured" },
      ),
    ).toEqual({
      blocks: [{ role: "narration", text: "Hello" }],
    });
  });

  it("wraps bare block arrays", () => {
    expect(
      parseStructuredMessageContent(
        JSON.stringify([{ role: "narration", text: "Hello" }]),
        { format: "structured" },
      ),
    ).toEqual({
      blocks: [{ role: "narration", text: "Hello" }],
    });
  });

  it("returns null for invalid structured content", () => {
    expect(parseStructuredMessageContent("{oops", { format: "structured" })).toBeNull();
  });
});

describe("mapMessage", () => {
  it("hydrates structured content onto messages", () => {
    const message = mapMessage({
      id: 7,
      chat_id: 3,
      role: "assistant",
      name: "Guide",
      content: JSON.stringify({ blocks: [{ role: "narration", text: "Plan" }] }),
      is_hidden: 0,
      swipe_id: 0,
      swipes: "[]",
      gen_started: null,
      gen_finished: null,
      extra: JSON.stringify({ format: "structured", reasoning: "why" }),
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(message.structuredContent).toEqual({
      blocks: [{ role: "narration", text: "Plan" }],
    });
    expect(message.reasoning).toBe("why");
  });
});
