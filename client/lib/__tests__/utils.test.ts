import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../utils";

describe("getErrorMessage", () => {
  it("returns the error message when given an Error", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back for non-Error values", () => {
    expect(getErrorMessage("boom", "fallback")).toBe("fallback");
  });
});
