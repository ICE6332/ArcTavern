"use client";

import { useRef, useEffect, useMemo } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { chatDebug } from "@/lib/chat-debug";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { useTranslation } from "@/lib/i18n";

export function ChatPanel() {
  const { t } = useTranslation();
  const {
    messages,
    isGenerating,
    streamingContent,
    streamingReasoning,
    currentChatId,
    sendMessage,
    stopGeneration,
    regenerate,
    continueMessage,
    impersonate,
    swipe,
    deleteMessage,
  } = useChatStore();
  const selectedId = useCharacterStore((s) => s.selectedId);
  const characters = useCharacterStore((s) => s.characters);
  const connection = useConnectionStore();
  const promptComponents = usePromptManagerStore((s) => s.components);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const selectedChar = characters.find((c) => c.id === selectedId);
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);
  const hasAssistantMessage = latestAssistantMessageId !== null;

  // Build prompt order and custom prompts from the prompt manager
  const promptOrder = useMemo(
    () =>
      [...promptComponents]
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ identifier: c.id, enabled: c.enabled })),
    [promptComponents],
  );

  const customPrompts = useMemo(
    () =>
      promptComponents
        .filter((c) => c.enabled && c.content !== undefined && c.content.trim() !== "")
        .map((c) => ({
          identifier: c.id,
          role: c.role,
          content: c.content!,
        })),
    [promptComponents],
  );

  const generationConfig = useMemo(
    () => ({
      provider: connection.provider,
      model: connection.model,
      temperature: connection.temperature,
      maxTokens: connection.maxTokens,
      topP: connection.topP,
      topK: connection.topK,
      frequencyPenalty: connection.frequencyPenalty,
      presencePenalty: connection.presencePenalty,
      reverseProxy: connection.reverseProxy || undefined,
      maxContext: connection.maxContext,
      promptOrder,
      customPrompts,
    }),
    [connection, promptOrder, customPrompts],
  );

  useEffect(() => {
    if (!scrollRef.current || !shouldAutoScrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent, streamingReasoning]);

  useEffect(() => {
    chatDebug("panel.state", {
      currentChatId,
      selectedCharacterId: selectedId,
      messageCount: messages.length,
      isGenerating,
      streamingLength: streamingContent.length,
      reasoningLength: streamingReasoning.length,
    });
  }, [
    currentChatId,
    selectedId,
    messages.length,
    isGenerating,
    streamingContent.length,
    streamingReasoning.length,
  ]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [currentChatId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  const handleSend = async (content: string) => {
    if (!currentChatId || !content.trim()) return;
    chatDebug("panel.send", {
      currentChatId,
      contentLength: content.trim().length,
    });
    await sendMessage(content, generationConfig);
  };

  if (!selectedId) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">{t("chat.welcome")}</p>
          <p className="mt-1 text-sm">{t("chat.selectCharacter")}</p>
        </div>
      </main>
    );
  }

  if (!currentChatId) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">{t("chat.selectChat")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 items-center border-b border-border px-4">
        <span className="text-sm font-medium">{selectedChar?.name ?? t("chat.defaultTitle")}</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 scrollbar-chat p-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              messageId={msg.id}
              role={msg.role}
              name={msg.name || (msg.role === "assistant" ? selectedChar?.name : undefined)}
              content={msg.content}
              reasoning={msg.reasoning}
              swipeId={msg.swipeId}
              swipes={msg.swipes}
              onSwipe={swipe}
              onDelete={deleteMessage}
              onRegenerate={
                msg.role === "assistant" && msg.id === latestAssistantMessageId
                  ? () => regenerate(generationConfig)
                  : undefined
              }
            />
          ))}

          {/* Streaming message */}
          {isGenerating && (
            <MessageBubble
              role="assistant"
              name={selectedChar?.name}
              content={streamingContent}
              reasoning={streamingReasoning}
              isStreaming
            />
          )}

          {/* Generating indicator */}
          {isGenerating && !streamingContent && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                {selectedChar?.name?.charAt(0)?.toUpperCase() ?? "A"}
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
                <span className="text-shimmer">Generating...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={stopGeneration}
        onContinue={() => continueMessage(generationConfig)}
        onImpersonate={() => impersonate(generationConfig)}
        onRegenerate={() => regenerate(generationConfig)}
        canContinue={hasAssistantMessage}
        canRegenerate={hasAssistantMessage}
        isGenerating={isGenerating}
        disabled={false}
      />
    </main>
  );
}
