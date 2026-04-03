/**
 * XML custom tag stripper for SillyTavern compatibility.
 *
 * Soft-isolated: this module lives in `lib/compat/` and is only consumed
 * through `preprocessor.ts`. Core code never imports from here directly.
 *
 * Two modes:
 * - "strip": remove tags, keep inner content (default for unknown tags)
 * - "remove": remove tags AND inner content (for update/variable blocks)
 */

import { stCompatAllowedTagNameSet } from "@/lib/compat/html-tags";

/** Tags whose content should be completely removed (not displayed) */
const REMOVE_TAGS_DEFAULT = [
  "update",
  "updatevariable",
  "variableinsert",
  "variableedit",
  "variabledelete",
  "era_data",
];

/**
 * Strip custom XML-like tags from content.
 *
 * @param content - Raw message content
 * @param options - Optional overrides for tag handling
 * @returns Cleaned content
 */
export function stripXmlTags(
  content: string,
  options?: {
    removeTags?: string[];
  },
): string {
  if (!content) return content;

  const removeTags = options?.removeTags ?? REMOVE_TAGS_DEFAULT;

  let result = content;

  // Phase 1: Remove tags + content for "remove" tags (e.g. <update>...</update>)
  for (const tag of removeTags) {
    // Match both <tag>...</tag> and self-closing, case-insensitive, multiline
    const pattern = new RegExp(
      `<${tag}(?:\\s[^>]*)?>` + // opening tag with optional attributes
        `[\\s\\S]*?` + // content (lazy)
        `<\\/${tag}>`, // closing tag
      "gi",
    );
    result = result.replace(pattern, "");
  }

  // Phase 2: Strip remaining custom XML tags, keeping inner content.
  // Allowed HTML tags are preserved intact so the downstream markdown/rehype pipeline
  // can sanitize and render them consistently.

  // Strip paired custom tags: <tag>content</tag> → content
  result = result.replace(
    /<([a-zA-Z][\w-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g,
    (match, tagName: string) => {
      if (stCompatAllowedTagNameSet.has(tagName.toLowerCase())) return match;
      // Strip the opening and closing tags, keep content
      const openEnd = match.indexOf(">") + 1;
      const closeStart = match.lastIndexOf("</");
      return match.slice(openEnd, closeStart);
    },
  );

  // Strip orphaned opening tags (no matching close): <tag> → ""
  result = result.replace(/<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/g, (match, tagName: string) => {
    if (stCompatAllowedTagNameSet.has(tagName.toLowerCase())) return match;
    return "";
  });

  // Strip orphaned closing tags: </tag> → ""
  result = result.replace(/<\/([a-zA-Z][\w-]*)>/g, (match, tagName: string) => {
    if (stCompatAllowedTagNameSet.has(tagName.toLowerCase())) return match;
    return "";
  });

  // Clean up excessive blank lines left by removal
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
