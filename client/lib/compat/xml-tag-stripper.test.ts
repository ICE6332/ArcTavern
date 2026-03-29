import { describe, it, expect } from "vitest";
import { stripXmlTags } from "./xml-tag-stripper";

describe("stripXmlTags", () => {
  it("strips <gametxt> keeping content", () => {
    expect(stripXmlTags("<gametxt>Hello world</gametxt>")).toBe("Hello world");
  });

  it("strips <opening> keeping content", () => {
    expect(stripXmlTags("<opening>\n故事开始了\n</opening>")).toBe("故事开始了");
  });

  it("strips <customized> keeping content", () => {
    expect(stripXmlTags("<customized>\n你想要什么\n</customized>")).toBe("你想要什么");
  });

  it("removes <update> with content entirely", () => {
    expect(stripXmlTags("before <update>vars here</update> after")).toBe("before  after");
  });

  it("removes <updatevariable> with content entirely", () => {
    expect(stripXmlTags("before <updatevariable>vars</updatevariable> after")).toBe(
      "before  after",
    );
  });

  it("handles mixed tags", () => {
    const input = `<customized>
你想要什么样的自定义开局？都满足你
</customized>
<gametxt>
强烈的失重感如同巨锤猛击后脑。
</gametxt>
<update>HP: 100</update>`;
    const result = stripXmlTags(input);
    expect(result).toContain("你想要什么样的自定义开局");
    expect(result).toContain("强烈的失重感");
    expect(result).not.toContain("<customized>");
    expect(result).not.toContain("<gametxt>");
    expect(result).not.toContain("HP: 100");
    expect(result).not.toContain("<update>");
  });

  it("preserves standard HTML tags", () => {
    expect(stripXmlTags("<b>bold</b> and <em>italic</em>")).toBe("<b>bold</b> and <em>italic</em>");
  });

  it("strips orphaned opening tags", () => {
    expect(stripXmlTags("before <gametxt> after")).toBe("before  after");
  });

  it("strips orphaned closing tags", () => {
    expect(stripXmlTags("before </gametxt> after")).toBe("before  after");
  });

  it("handles empty input", () => {
    expect(stripXmlTags("")).toBe("");
    expect(stripXmlTags(null as unknown as string)).toBe(null);
  });

  it("handles content with no XML tags", () => {
    expect(stripXmlTags("Just plain text")).toBe("Just plain text");
  });

  it("collapses excessive newlines from removal", () => {
    const input = "before\n\n\n\n\nafter";
    expect(stripXmlTags(input)).toBe("before\n\nafter");
  });

  it("handles tags with attributes", () => {
    expect(stripXmlTags('<gametxt class="intro">Hello</gametxt>')).toBe("Hello");
  });
});
