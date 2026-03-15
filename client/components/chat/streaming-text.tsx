"use client";

import { useEffect, useState } from "react";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState(content);

  useEffect(() => {
    setDisplayed(content);
  }, [content]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {displayed}
      {isStreaming && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse rounded-full bg-current align-text-bottom" />
      )}
    </span>
  );
}
