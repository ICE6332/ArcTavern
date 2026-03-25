import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGenerationConfig } from "./use-generation-config";
import type { PromptComponent } from "@/stores/prompt-manager-store";

const promptComponents: PromptComponent[] = [
  {
    id: "beta",
    name: "Beta",
    enabled: true,
    position: 2,
    role: "user",
    content: "Beta prompt",
    isBuiltIn: false,
    isMarker: false,
  },
  {
    id: "alpha",
    name: "Alpha",
    enabled: true,
    position: 1,
    role: "system",
    content: "Alpha prompt",
    isBuiltIn: false,
    isMarker: false,
  },
];

describe("useGenerationConfig", () => {
  it("sorts prompt order and merges world info ids", () => {
    const { result } = renderHook(() =>
      useGenerationConfig({
        connection: {
          provider: "custom",
          model: "demo",
          temperature: 0.7,
          maxTokens: 1000,
          topP: 1,
          topK: 0,
          frequencyPenalty: 0,
          presencePenalty: 0,
          reverseProxy: "",
          maxContext: 4096,
          openUiEnabled: true,
          customApiFormat: "openai-compatible",
        },
        promptComponents,
        activeBookIds: [2, 3],
        selectedChar: { worldInfoBookId: 1 },
      }),
    );

    expect(result.current.promptOrder.map((item) => item.identifier)).toEqual([
      "alpha",
      "beta",
      "openui_instructions",
    ]);
    expect(result.current.generationConfig.worldInfoBookIds).toEqual([1, 2, 3]);
    expect(result.current.customPrompts.at(-1)).toEqual({
      identifier: "openui_instructions",
      role: "system",
      content: expect.any(String),
    });
  });
});
