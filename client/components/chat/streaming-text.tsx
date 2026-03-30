"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import { motion } from "motion/react";
import {
  compatMarkdownRemarkPlugins,
  compatMarkdownRehypePlugins,
} from "@/lib/compat/markdown-pipeline";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

const streamingMarkdownStyles =
  "whitespace-pre-wrap break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

const fadeTransition = { duration: 0.15, ease: "easeOut" as const };
const fadeInitial = { opacity: 0, y: 4 };
const fadeAnimate = { opacity: 1, y: 0 };

const streamingComponents = {
  p: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <motion.p
      initial={fadeInitial}
      animate={fadeAnimate}
      transition={fadeTransition}
      className={className}
    >
      {children}
    </motion.p>
  ),
  blockquote: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <motion.blockquote
      initial={fadeInitial}
      animate={fadeAnimate}
      transition={fadeTransition}
      className={className}
    >
      {children}
    </motion.blockquote>
  ),
  pre: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <motion.pre
      initial={fadeInitial}
      animate={fadeAnimate}
      transition={fadeTransition}
      className={className}
    >
      {children}
    </motion.pre>
  ),
  table: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <motion.table
      initial={fadeInitial}
      animate={fadeAnimate}
      transition={fadeTransition}
      className={className}
    >
      {children}
    </motion.table>
  ),
} satisfies Components;

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative inline-block max-w-full">
      <div className={streamingMarkdownStyles}>
        <ReactMarkdown
          remarkPlugins={compatMarkdownRemarkPlugins}
          rehypePlugins={compatMarkdownRehypePlugins}
          components={streamingComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse rounded-full bg-current align-text-bottom" />
      )}
    </div>
  );
}
