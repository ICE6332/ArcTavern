/**
 * rehype-sanitize schema for SillyTavern-style HTML in assistant messages.
 * Script/style tags are NOT allowed (Phase 1); scripts run only via js-runtime sandbox.
 */

import { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";

const extraTagNames = [
  "div",
  "span",
  "br",
  "hr",
  "em",
  "strong",
  "details",
  "summary",
  "p",
] as const;

const baseTags = defaultSchema.tagNames ?? [];

export const stCompatSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...new Set([...baseTags, ...extraTagNames])],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...new Set([...(defaultSchema.attributes?.["*"] ?? []), "style", "class"])],
    details: [...new Set([...(defaultSchema.attributes?.details ?? []), "open"])],
  },
};
