import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSSE } from "../stream";

describe("readSSE", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("surfaces readable stream errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "denied" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const iterator = readSSE("/api/test", { method: "POST" });

    await expect(iterator.next()).rejects.toThrow("Stream error: 400 - denied");
  });
});
