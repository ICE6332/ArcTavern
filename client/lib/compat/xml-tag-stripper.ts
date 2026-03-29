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

/** Tags whose content should be completely removed (not displayed) */
const REMOVE_TAGS_DEFAULT = ["update", "updatevariable"];

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
  // Match paired tags like <gametxt>...</gametxt>, <opening>...</opening>, etc.
  // Excludes standard HTML tags that react-markdown handles.
  // Uses a conservative approach: only strip tags that look like custom identifiers.
  const HTML_TAGS = new Set([
    "a",
    "abbr",
    "b",
    "blockquote",
    "br",
    "code",
    "dd",
    "del",
    "details",
    "div",
    "dl",
    "dt",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "ins",
    "kbd",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
    "var",
    "wbr",
  ]);

  // Strip paired custom tags: <tag>content</tag> → content
  result = result.replace(
    /<([a-zA-Z][\w-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g,
    (match, tagName: string) => {
      if (HTML_TAGS.has(tagName.toLowerCase())) return match;
      // Strip the opening and closing tags, keep content
      const openEnd = match.indexOf(">") + 1;
      const closeStart = match.lastIndexOf("</");
      return match.slice(openEnd, closeStart);
    },
  );

  // Strip orphaned opening tags (no matching close): <tag> → ""
  result = result.replace(/<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/g, (match, tagName: string) => {
    if (HTML_TAGS.has(tagName.toLowerCase())) return match;
    return "";
  });

  // Strip orphaned closing tags: </tag> → ""
  result = result.replace(/<\/([a-zA-Z][\w-]*)>/g, (match, tagName: string) => {
    if (HTML_TAGS.has(tagName.toLowerCase())) return match;
    return "";
  });

  // Clean up excessive blank lines left by removal
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
