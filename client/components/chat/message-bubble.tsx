"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import { StreamingText } from "./streaming-text";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
} from "@/components/ai-elements/chain-of-thought";

interface MessageBubbleProps {
  messageId?: number;
  role: "user" | "assistant" | "system" | "tool";
  name?: string;
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  swipeId?: number;
  swipes?: string[];
  onSwipe?: (messageId: number, direction: "left" | "right") => void;
  onRegenerate?: () => void;
  onDelete?: (messageId: number) => void;
}

export function MessageBubble({
  messageId,
  role,
  name,
  content,
  reasoning,
  isStreaming,
  swipeId = 0,
  swipes = [],
  onSwipe,
  onRegenerate,
  onDelete,
}: MessageBubbleProps) {
  const isUser = role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isUser ? "U" : (name?.charAt(0)?.toUpperCase() ?? "A")}
      </div>

      <div className={`max-w-[88%] ${isUser ? "text-right" : ""}`}>
        {name && !isUser && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">{name}</p>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground"
          }`}
        >
          {reasoning && !isUser && (
            <ChainOfThought className="mb-3 border-b border-border pb-3">
              <ChainOfThoughtHeader>Thinking</ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 whitespace-pre-wrap break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {reasoning}
                  </ReactMarkdown>
                </div>
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}
          {isStreaming ? (
            <StreamingText content={content} isStreaming />
          ) : (
            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && !isStreaming && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {messageId && swipes.length > 1 && onSwipe && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onSwipe(messageId, "left")}
                >
                  {"<"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {swipeId + 1}/{swipes.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => onSwipe(messageId, "right")}
                >
                  {">"}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCopy}>
              Copy
            </Button>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onRegenerate}
              >
                Regenerate
              </Button>
            )}
            {messageId && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive"
                onClick={() => onDelete(messageId)}
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
