/**
 * rehype-sanitize schema for SillyTavern-style HTML in assistant messages.
 * Script/style tags are NOT allowed (Phase 1); scripts run only via js-runtime sandbox.
 */

import { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";
import { stCompatAllowedTagNames } from "@/lib/compat/html-tags";

export const stCompatSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: stCompatAllowedTagNames,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...new Set([...(defaultSchema.attributes?.["*"] ?? []), "style", "class"])],
    details: [...new Set([...(defaultSchema.attributes?.details ?? []), "open"])],
    font: ["color", "face", "size"],
  },
};
