import { describe, expect, it } from "vitest";
import { extractAssistantRenderSegments, extractCompatBridgeData } from "../widget-pipeline";

describe("extractCompatBridgeData", () => {
  it("extracts variableinsert JSON as statWithoutMeta", () => {
    const raw = `<VariableInsert>
{"player":{"name":"Alice"},"world_state":{"location":"旧校舍"}}
</VariableInsert>`;

    expect(extractCompatBridgeData(raw)).toEqual({
      statWithoutMeta: {
        player: { name: "Alice" },
        world_state: { location: "旧校舍" },
      },
      variableInsert: {
        player: { name: "Alice" },
        world_state: { location: "旧校舍" },
      },
    });
  });
});

describe("extractAssistantRenderSegments", () => {
  it("extracts fenced HTML documents as widget segments", () => {
    const content = `前文\n\`\`\`html\n<!DOCTYPE html><html><body><div id="app"></div></body></html>\n\`\`\`\n后文`;
    const segments = extractAssistantRenderSegments(content);

    expect(segments).toEqual([
      { type: "markdown", content: "前文\n" },
      {
        type: "widget",
        html: '<!DOCTYPE html><html><body><div id="app"></div></body></html>',
      },
      { type: "markdown", content: "\n后文" },
    ]);
  });

  it("extracts raw HTML documents as widget segments", () => {
    const content = `说明\n<!DOCTYPE html><html><body><div id="app"></div></body></html>`;
    const segments = extractAssistantRenderSegments(content);

    expect(segments).toEqual([
      { type: "markdown", content: "说明\n" },
      {
        type: "widget",
        html: '<!DOCTYPE html><html><body><div id="app"></div></body></html>',
      },
    ]);
  });
});
