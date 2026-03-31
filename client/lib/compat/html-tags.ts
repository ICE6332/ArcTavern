import { defaultSchema } from "rehype-sanitize";

const extraTagNames = [
  "article",
  "aside",
  "br",
  "button",
  "center",
  "details",
  "div",
  "em",
  "figcaption",
  "figure",
  "font",
  "footer",
  "header",
  "hr",
  "main",
  "nav",
  "p",
  "section",
  "span",
  "strong",
  "style",
  "summary",
  "time",
] as const;

const baseTagNames = defaultSchema.tagNames ?? [];

export const stCompatAllowedTagNames = [...new Set([...baseTagNames, ...extraTagNames])];
export const stCompatAllowedTagNameSet = new Set(stCompatAllowedTagNames);
