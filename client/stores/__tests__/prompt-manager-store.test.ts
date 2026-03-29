import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePromptManagerStore } from "../prompt-manager-store";

describe("usePromptManagerStore", () => {
  beforeEach(() => {
    usePromptManagerStore.getState().resetToDefaults();
  });

  afterEach(() => undefined);

  it("toggles and reorders components", () => {
    const store = usePromptManagerStore.getState();
    const initialLength = store.components.length;

    store.toggleComponent("main");
    store.moveComponent("main", 2);

    const next = usePromptManagerStore.getState().components;
    expect(next.find((component) => component.id === "main")?.enabled).toBe(false);
    expect(next[2].id).toBe("main");
    expect(next.map((component) => component.position)).toEqual(
      Array.from({ length: initialLength }, (_, index) => index),
    );
  });

  it("loads from preset order and exports the current format", () => {
    usePromptManagerStore.getState().loadFromPreset(
      [
        {
          identifier: "custom_style",
          name: "Custom Style",
          role: "user",
          content: "Keep it punchy",
        },
        {
          identifier: "main",
          name: "Main Prompt",
          role: "system",
          content: "Main body",
        },
      ],
      [
        {
          character_id: 100001,
          order: [
            { identifier: "custom_style", enabled: true },
            { identifier: "main", enabled: false },
          ],
        },
      ],
    );

    const components = usePromptManagerStore.getState().components;
    expect(components.map((component) => component.id)).toEqual(["custom_style", "main"]);
    expect(components[0].enabled).toBe(true);
    expect(components[1].enabled).toBe(false);

    const exported = usePromptManagerStore.getState().exportToPresetFormat();
    expect(exported.prompt_order).toEqual([
      {
        character_id: 100000,
        order: [
          { identifier: "custom_style", enabled: true },
          { identifier: "main", enabled: false },
        ],
      },
    ]);
    expect(exported.prompts).toEqual([
      {
        identifier: "custom_style",
        name: "Custom Style",
        system_prompt: false,
        role: "user",
        content: "Keep it punchy",
      },
      {
        identifier: "main",
        name: "Main Prompt",
        system_prompt: true,
        role: "system",
        content: "Main body",
      },
    ]);
  });
});
