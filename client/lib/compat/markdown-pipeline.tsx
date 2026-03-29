"use client";

import ReactMarkdown, { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { stCompatSanitizeSchema } from "@/lib/compat/sanitize-schema";

type RehypePluginList = NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

/** Shared rehype chain: raw HTML → sanitize (ST-compat) → code highlight */
export const compatMarkdownRehypePlugins: RehypePluginList = [
  rehypeRaw,
  [rehypeSanitize, stCompatSanitizeSchema],
  rehypeHighlight,
];

export const compatMarkdownRemarkPlugins = [remarkGfm];

export function CompatMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={compatMarkdownRemarkPlugins}
        rehypePlugins={compatMarkdownRehypePlugins}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
