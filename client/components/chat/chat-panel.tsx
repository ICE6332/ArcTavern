"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { chatDebug } from "@/lib/chat-debug";
import { getOpenUiSystemPrompt } from "@/lib/openui";
import type { ActionEvent } from "@openuidev/react-lang";
import {
  isStructuredResponse,
  type PartialStructuredResponse,
} from "@/lib/openui/structured-types";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { DotsLoader } from "@/components/ui/loader";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useTranslation } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, FileImportIcon, Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { executeSlashCommand } from "@/lib/slash-commands/executor";

const GREETINGS = [
  "欢迎回来~ 今天也要开心地聊天呀",
  "好想你呀，终于等到你来了",
  "你来啦~ 世界都变得明亮了呢",
  "每次见到你都好开心，今天聊点什么呢",
  "等你好久了~ 快来和我聊聊天吧",
  "又见面了呢，今天的你一定也很棒",
];

export function ChatPanel() {
  const { t } = useTranslation();
  const {
    messages,
    isGenerating,
    streamingContent,
    streamingReasoning,
    streamingStructured,
    currentChatId,
    sendMessage,
    stopGeneration,
    regenerate,
    generateSwipe,
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
  const generationType = useChatStore((s) => s.generationType);
  const isSwipeGenerating =
    isGenerating && (generationType === "swipe" || generationType === "regenerate");
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);
  const hasAssistantMessage = latestAssistantMessageId !== null;

  const openUiEnabled = connection.openUiEnabled;

  const promptOrder = useMemo(() => {
    const order = [...promptComponents]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ identifier: c.id, enabled: c.enabled }));
    if (openUiEnabled) {
      order.push({ identifier: "openui_instructions", enabled: true });
    }
    return order;
  }, [promptComponents, openUiEnabled]);

  const customPrompts = useMemo(() => {
    const prompts = promptComponents
      .filter((c) => c.enabled && c.content !== undefined && c.content.trim() !== "")
      .map((c) => ({
        identifier: c.id,
        role: c.role,
        content: c.content!,
      }));
    if (openUiEnabled) {
      prompts.push({
        identifier: "openui_instructions",
        role: "system",
        content: getOpenUiSystemPrompt(),
      });
    }
    return prompts;
  }, [promptComponents, openUiEnabled]);

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
      structuredOutput: openUiEnabled,
      customApiFormat: connection.provider === "custom" ? connection.customApiFormat : undefined,
    }),
    [connection, promptOrder, customPrompts, openUiEnabled],
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

  const handleOpenUiAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === "continue_conversation") {
        void sendMessage(event.humanFriendlyMessage, generationConfig);
      } else if (event.type === "open_url") {
        const url = event.params.url as unknown;
        if (typeof url === "string") {
          window.open(url, "_blank", "noopener");
        }
      }
    },
    [sendMessage, generationConfig],
  );

  const handleSend = (content: string) => {
    if (!currentChatId || !content.trim()) return;
    chatDebug("panel.send", {
      currentChatId,
      contentLength: content.trim().length,
    });
    void sendMessage(content, generationConfig);
  };

  const handleCommandAction = useCallback(
    (command: string) => {
      if (!currentChatId) return;
      void executeSlashCommand(command, currentChatId);
    },
    [currentChatId],
  );

  if (!selectedId || !currentChatId) {
    return <WelcomeScreen />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-medium">{selectedChar?.name ?? t("chat.defaultTitle")}</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 [scrollbar-gutter:stable]"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((msg) => {
            const isLastAssistant = msg.role === "assistant" && msg.id === latestAssistantMessageId;
            const showSwipeStreaming = isLastAssistant && isSwipeGenerating;

            // For persisted structured messages, parse the JSON content back
            let persistedStructured: PartialStructuredResponse | undefined;
            if (!showSwipeStreaming && msg.extra?.format === "structured" && msg.content) {
              try {
                const parsed: unknown = JSON.parse(msg.content);
                if (isStructuredResponse(parsed)) {
                  persistedStructured = parsed;
                } else if (Array.isArray(parsed)) {
                  // Model returned bare blocks array — wrap it
                  persistedStructured = { blocks: parsed };
                }
              } catch {
                // Not valid JSON — render as plain text
              }
            }

            return (
              <MessageBubble
                key={msg.id}
                messageId={msg.id}
                role={msg.role}
                name={msg.name || (msg.role === "assistant" ? selectedChar?.name : undefined)}
                content={
                  showSwipeStreaming
                    ? streamingContent || ""
                    : persistedStructured
                      ? ""
                      : msg.content
                }
                reasoning={showSwipeStreaming ? streamingReasoning || undefined : msg.reasoning}
                isStreaming={showSwipeStreaming}
                swipeId={msg.swipeId}
                swipes={msg.swipes}
                onSwipe={(messageId, direction) => {
                  void swipe(messageId, direction);
                }}
                onDelete={(messageId) => {
                  void deleteMessage(messageId);
                }}
                openUiEnabled={openUiEnabled}
                onOpenUiAction={handleOpenUiAction}
                structuredContent={showSwipeStreaming ? streamingStructured : persistedStructured}
                onStructuredAction={(label) => void sendMessage(label, generationConfig)}
                onStructuredCommandAction={handleCommandAction}
                onRegenerate={
                  isLastAssistant && !isGenerating
                    ? () => void generateSwipe(generationConfig)
                    : undefined
                }
              />
            );
          })}

          {isGenerating &&
            !isSwipeGenerating &&
            (streamingContent || streamingReasoning || streamingStructured) && (
              <MessageBubble
                role="assistant"
                name={selectedChar?.name}
                content={streamingContent}
                reasoning={streamingReasoning}
                isStreaming
                openUiEnabled={openUiEnabled}
                onOpenUiAction={handleOpenUiAction}
                structuredContent={streamingStructured}
                onStructuredAction={(label) => void sendMessage(label, generationConfig)}
                onStructuredCommandAction={handleCommandAction}
              />
            )}

          {isGenerating &&
            !isSwipeGenerating &&
            !streamingContent &&
            !streamingReasoning &&
            !streamingStructured && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {selectedChar?.name ?? "Assistant"}
                </p>
                <DotsLoader size="md" className="text-muted-foreground" />
              </div>
            )}
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        onStop={stopGeneration}
        onContinue={() => void continueMessage(generationConfig)}
        onImpersonate={() => void impersonate(generationConfig)}
        chatId={currentChatId ?? undefined}
        canContinue={hasAssistantMessage}
        isGenerating={isGenerating}
        disabled={false}
      />
    </main>
  );
}

function WelcomeScreen() {
  const { createCharacter, fetchCharacters } = useCharacterStore();
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const handleCreateCharacter = async () => {
    const created = await createCharacter({
      name: "New Character",
      description: "",
    });
    useCharacterStore.getState().selectCharacter(created.id);
    const { createChat, selectChat } = useChatStore.getState();
    const chat = await createChat(created.id);
    await selectChat(chat.id);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            <Shimmer duration={3} spread={1.5}>
              {`✦ ${greeting}`}
            </Shimmer>
          </h1>
          <p className="text-sm text-muted-foreground">在侧边栏选一个角色，开启你的奇妙对话吧</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <PromptSuggestion onClick={() => void fetchCharacters()}>
            <HugeiconsIcon icon={UserIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">浏览角色</span>
          </PromptSuggestion>
          <PromptSuggestion onClick={() => void handleCreateCharacter()}>
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">创建角色</span>
          </PromptSuggestion>
          <PromptSuggestion>
            <HugeiconsIcon icon={FileImportIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">导入角色</span>
          </PromptSuggestion>
          <PromptSuggestion>
            <HugeiconsIcon icon={UserGroupIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">群组聊天</span>
          </PromptSuggestion>
        </div>
      </div>
    </main>
  );
}
