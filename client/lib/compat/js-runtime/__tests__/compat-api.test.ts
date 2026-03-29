import { describe, expect, it, vi } from "vitest";
import { createCompatApiBindings, ST_COMPAT_VARS_KEY } from "../compat-api";

describe("createCompatApiBindings", () => {
  it("getVar and setVar round-trip via persistExtra", async () => {
    let extra: Record<string, unknown> = {};
    const persistExtra = vi.fn(async (next: Record<string, unknown>) => {
      extra = next;
    });

    const api = createCompatApiBindings({
      swipeId: 0,
      swipesLength: 1,
      getExtra: () => extra,
      persistExtra,
      getMessages: () => [],
      getCharName: () => "Char",
      getCharAvatar: () => "",
    }) as {
      getVar: (k: string) => unknown;
      setVar: (k: string, v: unknown) => void;
    };

    expect(api.getVar("hp")).toBeUndefined();

    api.setVar("hp", 10);
    await vi.waitFor(() => expect(persistExtra).toHaveBeenCalled());

    const written = persistExtra.mock.calls[0]![0] as Record<string, unknown>;
    expect(Array.isArray(written[ST_COMPAT_VARS_KEY])).toBe(true);
    expect((written[ST_COMPAT_VARS_KEY] as unknown[])[0]).toEqual({ hp: 10 });

    extra = written;
    expect(api.getVar("hp")).toBe(10);
  });

  it("addVar increments numeric key", async () => {
    let extra: Record<string, unknown> = {
      [ST_COMPAT_VARS_KEY]: [{ n: 1 }],
    };
    const persistExtra = vi.fn(async (next: Record<string, unknown>) => {
      extra = next;
    });

    const api = createCompatApiBindings({
      swipeId: 0,
      swipesLength: 1,
      getExtra: () => extra,
      persistExtra,
      getMessages: () => [],
      getCharName: () => "",
      getCharAvatar: () => "",
    }) as { addVar: (k: string, d: number) => void; getVar: (k: string) => unknown };

    api.addVar("n", 2);
    await vi.waitFor(() => expect(persistExtra).toHaveBeenCalled());
    extra = persistExtra.mock.calls[0]![0] as Record<string, unknown>;
    expect(api.getVar("n")).toBe(3);
  });
});
