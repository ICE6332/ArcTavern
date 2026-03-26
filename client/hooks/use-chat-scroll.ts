"use client";

import { useCallback, useEffect, useRef } from "react";

export function useChatScroll({
  currentChatId,
  messagesLength,
  streamingContent,
  streamingReasoning,
}: {
  currentChatId: number | null;
  messagesLength: number;
  streamingContent: string;
  streamingReasoning: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (!scrollRef.current || !shouldAutoScrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messagesLength, streamingContent, streamingReasoning]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [currentChatId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }, []);

  return { scrollRef, handleScroll };
}
