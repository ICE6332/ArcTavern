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
        <span className="ml-0.5 inline-block h-4 w-[1px] animate-pulse bg-current align-middle" />
      )}
    </span>
  );
}

