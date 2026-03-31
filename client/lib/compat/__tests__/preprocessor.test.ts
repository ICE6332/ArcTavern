import { describe, expect, it } from "vitest";
import { preprocessContent } from "../preprocessor";
import type { RegexScriptData } from "../regex-engine";

describe("preprocessContent", () => {
  it("applies global ai_output regex scripts before XML stripping", () => {
    const globalScripts: RegexScriptData[] = [
      {
        scriptName: "opening-html",
        findRegex: "/<opening>([\\s\\S]*?)<\\/opening>/gi",
        replaceString: "<strong>$1</strong>",
        placement: [2],
      },
    ];

    expect(preprocessContent("<opening>Hello</opening>", null, globalScripts)).toBe(
      "<strong>Hello</strong>",
    );
  });

  it("preserves regex-generated HTML through XML stripping", () => {
    const extensions = {
      regex_scripts: [
        {
          scriptName: "legacy-font",
          findRegex: "/<gametxt>([\\s\\S]*?)<\\/gametxt>/gi",
          replaceString: '<font color="red">$1</font>',
          placement: [2],
        },
      ],
    };

    expect(preprocessContent("<gametxt>Hello</gametxt>", extensions)).toBe(
      '<font color="red">Hello</font>',
    );
  });

  it("preserves widget documents before XML stripping", () => {
    const extensions = {
      regex_scripts: [
        {
          scriptName: "widget-doc",
          findRegex: "/<StatusPlaceHolderImpl\\/>/gi",
          replaceString:
            '```html\n<!DOCTYPE html><html><head><style>.app{color:red;}</style></head><body><div class="app">Hello</div><script>window.foo = 1;</script></body></html>\n```',
          placement: [2],
        },
      ],
    };

    expect(preprocessContent("<StatusPlaceHolderImpl/>", extensions)).toContain(
      "<style>.app{color:red;}</style>",
    );
    expect(preprocessContent("<StatusPlaceHolderImpl/>", extensions)).toContain(
      "<script>window.foo = 1;</script>",
    );
  });
});
