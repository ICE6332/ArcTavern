"use client";

import { memo } from "react";
import type { Message } from "@/lib/api/chat";
import { MessageBubble } from "./message-bubble";
import type { ActionEvent } from "@openuidev/react-lang";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";

interface ChatMessageRowProps {
  message: Message;
  assistantName?: string;
  isSwipeStreaming: boolean;
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: PartialStructuredResponse | null;
  openUiEnabled: boolean;
  onSwipe: (messageId: number, direction: "left" | "right") => void;
  onDelete: (messageId: number) => void;
  onOpenUiAction: (event: ActionEvent) => void;
  onStructuredAction: (label: string) => void;
  onStructuredCommandAction: (command: string) => void;
  onRegenerate?: () => void;
}

function ChatMessageRowComponent({
  message,
  assistantName,
  isSwipeStreaming,
  streamingContent,
  streamingReasoning,
  streamingStructured,
  openUiEnabled,
  onSwipe,
  onDelete,
  onOpenUiAction,
  onStructuredAction,
  onStructuredCommandAction,
  onRegenerate,
}: ChatMessageRowProps) {
  const structuredContent = isSwipeStreaming ? streamingStructured : message.structuredContent;

  return (
    <MessageBubble
      messageId={message.id}
      role={message.role}
      name={message.name || (message.role === "assistant" ? assistantName : undefined)}
      content={isSwipeStreaming ? streamingContent : structuredContent ? "" : message.content}
      reasoning={isSwipeStreaming ? streamingReasoning || undefined : message.reasoning}
      isStreaming={isSwipeStreaming}
      swipeId={message.swipeId}
      swipes={message.swipes}
      onSwipe={onSwipe}
      onDelete={onDelete}
      openUiEnabled={openUiEnabled}
      onOpenUiAction={onOpenUiAction}
      structuredContent={structuredContent}
      onStructuredAction={(label) => onStructuredAction(label)}
      onStructuredCommandAction={onStructuredCommandAction}
      onRegenerate={onRegenerate}
    />
  );
}

export const ChatMessageRow = memo(ChatMessageRowComponent);
