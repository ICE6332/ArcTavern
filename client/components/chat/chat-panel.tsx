"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { useQuickReplyStore } from "@/stores/quick-reply-store";
import { useVariableStore } from "@/stores/variable-store";
import { chatDebug } from "@/lib/chat-debug";
import { getOpenUiSystemPrompt } from "@/lib/openui";
import type { ActionEvent } from "@openuidev/react-lang";
import { toast } from "@/lib/toast";
import { useSidebar } from "@/components/ui/sidebar";
import { consumeSlashCommandResult } from "@/lib/slash-commands/consume-result";
import { ChatInput } from "./chat-input";
import { ChatMessageRow } from "./chat-message-row";
import { MessageBubble } from "./message-bubble";
import { QuickReplyBar } from "./quick-reply-bar";
import { DotsLoader } from "@/components/ui/loader";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useTranslation } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, FileImportIcon, Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { executeSlashCommand } from "@/lib/slash-commands/executor";
import { useWorldInfoStore } from "@/stores/world-info-store";

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
    generationType,
    streamingContent,
    streamingReasoning,
    streamingStructured,
    currentChatId,
    sendMessage,
    stopGeneration,
    generateSwipe,
    continueMessage,
    impersonate,
    swipe,
    deleteMessage,
    refreshCurrentChat,
    selectChat,
    createChat,
    deleteChat,
  } = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      isGenerating: s.isGenerating,
      generationType: s.generationType,
      streamingContent: s.streamingContent,
      streamingReasoning: s.streamingReasoning,
      streamingStructured: s.streamingStructured,
      currentChatId: s.currentChatId,
      sendMessage: s.sendMessage,
      stopGeneration: s.stopGeneration,
      generateSwipe: s.generateSwipe,
      continueMessage: s.continueMessage,
      impersonate: s.impersonate,
      swipe: s.swipe,
      deleteMessage: s.deleteMessage,
      refreshCurrentChat: s.refreshCurrentChat,
      selectChat: s.selectChat,
      createChat: s.createChat,
      deleteChat: s.deleteChat,
    })),
  );
  const { selectedId, characters } = useCharacterStore(
    useShallow((s) => ({
      selectedId: s.selectedId,
      characters: s.characters,
    })),
  );
  const connection = useConnectionStore(
    useShallow((s) => ({
      provider: s.provider,
      model: s.model,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      topP: s.topP,
      topK: s.topK,
      frequencyPenalty: s.frequencyPenalty,
      presencePenalty: s.presencePenalty,
      reverseProxy: s.reverseProxy,
      maxContext: s.maxContext,
      openUiEnabled: s.openUiEnabled,
      customApiFormat: s.customApiFormat,
    })),
  );
  const promptComponents = usePromptManagerStore((s) => s.components);
  const quickRepliesLoaded = useQuickReplyStore((s) => s.loaded);
  const loadQuickReplies = useQuickReplyStore((s) => s.loadSets);
  const loadGlobalVariables = useVariableStore((s) => s.loadGlobalVariables);
  const loadChatVariables = useVariableStore((s) => s.loadChatVariables);
  const activeBookIds = useWorldInfoStore((s) => s.activeBookIds);
  const { toggleSidebar } = useSidebar();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const selectedChar = characters.find((c) => c.id === selectedId);
  const selectedCharName = selectedChar?.name;
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
      worldInfoBookIds: (() => {
        const ids = [...activeBookIds];
        const charBookId = selectedChar?.worldInfoBookId;
        if (charBookId && !ids.includes(charBookId)) ids.unshift(charBookId);
        return ids.length > 0 ? ids : undefined;
      })(),
    }),
    [
      activeBookIds,
      connection.customApiFormat,
      connection.frequencyPenalty,
      connection.maxContext,
      connection.maxTokens,
      connection.model,
      connection.presencePenalty,
      connection.provider,
      connection.reverseProxy,
      connection.temperature,
      connection.topK,
      connection.topP,
      customPrompts,
      openUiEnabled,
      promptOrder,
      selectedChar?.worldInfoBookId,
    ],
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

  useEffect(() => {
    void loadGlobalVariables();
  }, [loadGlobalVariables]);

  useEffect(() => {
    if (!quickRepliesLoaded) {
      void loadQuickReplies();
    }
  }, [quickRepliesLoaded, loadQuickReplies]);

  useEffect(() => {
    if (currentChatId) {
      void loadChatVariables(currentChatId);
    }
  }, [currentChatId, loadChatVariables]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  const displayCommandOutput = useCallback((text: string, kind: "info" | "error" = "info") => {
    const content = text.trim();
    if (!content) return;

    const [title, ...rest] = content.split("\n");
    const description = rest.join("\n").trim() || undefined;

    if (kind === "error") {
      toast.error({ title, description });
      return;
    }

    toast.success({ title, description });
  }, []);

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

  const handleSend = useCallback(
    async (content: string) => {
      if (!currentChatId || !content.trim()) return;
      chatDebug("panel.send", {
        currentChatId,
        contentLength: content.trim().length,
      });
      await sendMessage(content, generationConfig);
    },
    [currentChatId, generationConfig, sendMessage],
  );

  const handleSwipe = useCallback(
    (messageId: number, direction: "left" | "right") => {
      void swipe(messageId, direction);
    },
    [swipe],
  );

  const handleDeleteMessage = useCallback(
    (messageId: number) => {
      void deleteMessage(messageId);
    },
    [deleteMessage],
  );

  const handleStructuredAction = useCallback(
    (label: string) => {
      void handleSend(label);
    },
    [handleSend],
  );

  const handleGenerateSwipe = useCallback(() => {
    void generateSwipe(generationConfig);
  }, [generateSwipe, generationConfig]);

  const handleDeleteCurrentChat = useCallback(async () => {
    if (!currentChatId) return;

    await deleteChat(currentChatId);

    const nextChats = useChatStore.getState().chats;
    if (nextChats.length > 0) {
      await selectChat(nextChats[0].id);
      return;
    }

    if (!selectedId) {
      await selectChat(null);
      return;
    }

    const created = await createChat(selectedId);
    await selectChat(created.id);
  }, [createChat, currentChatId, deleteChat, selectChat, selectedId]);

  const runSlashCommand = useCallback(
    async (command: string) => {
      if (!currentChatId) {
        displayCommandOutput("Open a chat before running slash commands.", "error");
        return;
      }

      const result = await executeSlashCommand(command, currentChatId);
      await consumeSlashCommandResult(result, {
        onDisplay: displayCommandOutput,
        onSendMessage: handleSend,
        onImpersonate: () => impersonate(generationConfig),
        onContinue: () => continueMessage(generationConfig),
        onStop: stopGeneration,
        onDeleteCurrentChat: handleDeleteCurrentChat,
        onCloseChat: () => selectChat(null),
        onTogglePanels: toggleSidebar,
        onRefreshChat: refreshCurrentChat,
      });
    },
    [
      continueMessage,
      currentChatId,
      displayCommandOutput,
      generationConfig,
      handleDeleteCurrentChat,
      handleSend,
      impersonate,
      refreshCurrentChat,
      selectChat,
      stopGeneration,
      toggleSidebar,
    ],
  );

  if (!selectedId || !currentChatId) {
    return <WelcomeScreen />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-medium">{selectedCharName ?? t("chat.defaultTitle")}</span>
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

            return (
              <ChatMessageRow
                key={msg.id}
                message={msg}
                assistantName={selectedCharName}
                isSwipeStreaming={showSwipeStreaming}
                streamingContent={showSwipeStreaming ? streamingContent : ""}
                streamingReasoning={showSwipeStreaming ? streamingReasoning : ""}
                streamingStructured={showSwipeStreaming ? streamingStructured : null}
                openUiEnabled={openUiEnabled}
                onSwipe={handleSwipe}
                onDelete={handleDeleteMessage}
                onOpenUiAction={handleOpenUiAction}
                onStructuredAction={handleStructuredAction}
                onStructuredCommandAction={runSlashCommand}
                onRegenerate={
                  isLastAssistant && !isGenerating ? handleGenerateSwipe : undefined
                }
              />
            );
          })}

          {isGenerating &&
            !isSwipeGenerating &&
            (streamingContent || streamingReasoning || streamingStructured) && (
              <MessageBubble
                role="assistant"
                name={selectedCharName}
                content={streamingContent}
                reasoning={streamingReasoning}
                isStreaming
                openUiEnabled={openUiEnabled}
                onOpenUiAction={handleOpenUiAction}
                structuredContent={streamingStructured}
                onStructuredAction={handleStructuredAction}
                onStructuredCommandAction={runSlashCommand}
              />
            )}

          {isGenerating &&
            !isSwipeGenerating &&
            !streamingContent &&
            !streamingReasoning &&
            !streamingStructured && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {selectedCharName ?? "Assistant"}
                </p>
                <DotsLoader size="md" className="text-muted-foreground" />
              </div>
            )}
        </div>
      </div>

      <QuickReplyBar
        onExecute={(script) => {
          void runSlashCommand(script);
        }}
      />

      <ChatInput
        onSend={handleSend}
        onSlashCommand={runSlashCommand}
        onStop={stopGeneration}
        onContinue={() => void continueMessage(generationConfig)}
        onImpersonate={() => void impersonate(generationConfig)}
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
            <Shimmer duration={3} spread={1.5}>{`✦ ${greeting}`}</Shimmer>
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
