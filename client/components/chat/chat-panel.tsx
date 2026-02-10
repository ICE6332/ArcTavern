"use client";

import { useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useConnectionStore } from "@/stores/connection-store";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";

export function ChatPanel() {
  const { messages, isGenerating, streamingContent, currentChatId, sendMessage } =
    useChatStore();
  const selectedId = useCharacterStore((s) => s.selectedId);
  const characters = useCharacterStore((s) => s.characters);
  const connection = useConnectionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedChar = characters.find((c) => c.id === selectedId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = async (content: string) => {
    if (!currentChatId || !content.trim()) return;

    const systemMessages: { role: string; content: string }[] = [];
    if (selectedChar?.systemPrompt) {
      systemMessages.push({ role: "system", content: selectedChar.systemPrompt });
    }

    await sendMessage(content, {
      provider: connection.provider,
      model: connection.model,
      messages: systemMessages,
      temperature: connection.temperature,
      maxTokens: connection.maxTokens,
      topP: connection.topP,
      topK: connection.topK,
      frequencyPenalty: connection.frequencyPenalty,
      presencePenalty: connection.presencePenalty,
      reverseProxy: connection.reverseProxy || undefined,
    });
  };

  if (!selectedId) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Welcome to Arctravern</p>
          <p className="mt-1 text-sm">Select a character to start chatting</p>
        </div>
      </main>
    );
  }

  if (!currentChatId) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Select or create a chat to begin</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center border-b border-border px-4">
        <span className="text-sm font-medium">{selectedChar?.name ?? "Chat"}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* First message from character */}
          {messages.length === 0 && selectedChar?.firstMes && (
            <MessageBubble
              role="assistant"
              name={selectedChar.name}
              content={selectedChar.firstMes}
            />
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              name={msg.name || (msg.role === "assistant" ? selectedChar?.name : undefined)}
              content={msg.content}
            />
          ))}

          {/* Streaming message */}
          {isGenerating && streamingContent && (
            <MessageBubble
              role="assistant"
              name={selectedChar?.name}
              content={streamingContent}
              isStreaming
            />
          )}

          {isGenerating && !streamingContent && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Generating...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isGenerating} />
    </main>
  );
}
