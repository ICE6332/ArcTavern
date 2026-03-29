import { describe, it, expect } from "vitest";
import {
  regexFromString,
  runRegexScript,
  getDisplayRegexScripts,
  applyRegexScripts,
  type RegexScriptData,
} from "../regex-engine";

describe("regexFromString", () => {
  it("parses /pattern/flags notation", () => {
    const re = regexFromString("/hello/gi");
    expect(re).toBeInstanceOf(RegExp);
    expect(re!.source).toBe("hello");
    expect(re!.flags).toContain("g");
    expect(re!.flags).toContain("i");
  });

  it("parses plain regex string", () => {
    const re = regexFromString("hello");
    expect(re).toBeInstanceOf(RegExp);
    expect(re!.source).toBe("hello");
  });

  it("returns null for empty input", () => {
    expect(regexFromString("")).toBeNull();
  });

  it("returns null for invalid regex", () => {
    expect(regexFromString("/[invalid/")).toBeNull();
  });
});

describe("runRegexScript", () => {
  it("performs basic replacement", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "/hello/g",
      replaceString: "world",
      placement: [2],
    };
    expect(runRegexScript(script, "hello there, hello")).toBe("world there, world");
  });

  it("handles capture groups ($1)", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "/<(\\w+)>([^<]*)<\\/\\1>/g",
      replaceString: "$2",
      placement: [2],
    };
    expect(runRegexScript(script, "<b>bold</b> text")).toBe("bold text");
  });

  it("handles {{match}} as $0", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "/\\bword\\b/g",
      replaceString: "[{{match}}]",
      placement: [2],
    };
    expect(runRegexScript(script, "a word here")).toBe("a [word] here");
  });

  it("applies trimStrings to capture groups", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "/(hello world)/",
      replaceString: "$1",
      trimStrings: ["world"],
      placement: [2],
    };
    expect(runRegexScript(script, "say hello world now")).toBe("say hello  now");
  });

  it("skips disabled scripts", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "/hello/g",
      replaceString: "world",
      placement: [2],
      disabled: true,
    };
    expect(runRegexScript(script, "hello")).toBe("hello");
  });

  it("returns original for empty findRegex", () => {
    const script: RegexScriptData = {
      scriptName: "test",
      findRegex: "",
      replaceString: "world",
      placement: [2],
    };
    expect(runRegexScript(script, "hello")).toBe("hello");
  });

  // Real-world test: v4.2 card's XML tag folding regex
  it("handles v4.2 update tag removal", () => {
    const script: RegexScriptData = {
      scriptName: "[折叠]完整变量更新",
      findRegex: "/<update(?:variable)?>\\s*(.*?)\\s*<\\/update(?:variable)?>/gsi",
      replaceString: "",
      placement: [2],
    };
    expect(runRegexScript(script, "text <update>some vars</update> more text")).toBe(
      "text  more text",
    );
  });

  // Real-world test: Fate card's opening tag beautification
  it("handles Fate opening tag extraction", () => {
    const script: RegexScriptData = {
      scriptName: "开场白美化",
      findRegex: "/<opening>\\s*([\\s\\S]*?)\\s*<\\/opening>/gi",
      replaceString: "$1",
      placement: [2],
    };
    const input = "<opening>\n故事开始了\n</opening>";
    expect(runRegexScript(script, input)).toBe("故事开始了");
  });
});

describe("getDisplayRegexScripts", () => {
  it("returns empty for null extensions", () => {
    expect(getDisplayRegexScripts(null)).toEqual([]);
    expect(getDisplayRegexScripts(undefined)).toEqual([]);
  });

  it("returns empty for no regex_scripts", () => {
    expect(getDisplayRegexScripts({ fav: true })).toEqual([]);
  });

  it("filters enabled AI_OUTPUT scripts", () => {
    const extensions = {
      regex_scripts: [
        { scriptName: "a", findRegex: "/x/", replaceString: "y", placement: [2] },
        { scriptName: "b", findRegex: "/x/", replaceString: "y", placement: [1] },
        { scriptName: "c", findRegex: "/x/", replaceString: "y", placement: [2], disabled: true },
      ],
    };
    const scripts = getDisplayRegexScripts(extensions);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].scriptName).toBe("a");
  });
});

describe("applyRegexScripts", () => {
  it("chains multiple scripts in order", () => {
    const scripts: RegexScriptData[] = [
      { scriptName: "step1", findRegex: "/A/g", replaceString: "B", placement: [2] },
      { scriptName: "step2", findRegex: "/B/g", replaceString: "C", placement: [2] },
    ];
    expect(applyRegexScripts("A", scripts, "ai_output")).toBe("C");
  });

  it("skips scripts with wrong placement", () => {
    const scripts: RegexScriptData[] = [
      { scriptName: "user-only", findRegex: "/hello/", replaceString: "bye", placement: [1] },
    ];
    expect(applyRegexScripts("hello", scripts, "ai_output")).toBe("hello");
  });
});
