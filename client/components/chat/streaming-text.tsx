"use client";

import { CompatMarkdown } from "@/lib/compat/markdown-pipeline";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

const streamingMarkdownStyles =
  "whitespace-pre-wrap break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative inline-block max-w-full">
      <CompatMarkdown content={content} className={streamingMarkdownStyles} />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse rounded-full bg-current align-text-bottom" />
      )}
    </div>
  );
}
