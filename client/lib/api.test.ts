import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterApi, getApiBase } from "./api";

describe("getApiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses VITE_API_BASE when provided", () => {
    vi.stubEnv("VITE_API_BASE", "https://example.com/api///");

    expect(getApiBase()).toBe("https://example.com/api");
  });

  it("falls back to the proxied api path", () => {
    vi.stubEnv("VITE_API_BASE", "");

    expect(getApiBase()).toBe("/api");
  });
});

describe("characterApi", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_API_BASE", "");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefixes requests with the api base", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await characterApi.getAll();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/characters",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("throws a readable error for failed responses", async () => {
    fetchMock.mockResolvedValue(
      new Response("denied", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await expect(characterApi.getAll()).rejects.toThrow("API Error 403: denied");
  });
});
