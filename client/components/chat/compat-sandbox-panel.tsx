"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { useQuickReplyStore } from "@/stores/quick-reply-store";
import { useVariableStore } from "@/stores/variable-store";
import { useWorldInfoStore } from "@/stores/world-info-store";
import { useRegexStore } from "@/stores/regex-store";
import { useSidebar } from "@/components/ui/sidebar";
import { ChatInput } from "./chat-input";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import { QuickReplyBar } from "./quick-reply-bar";
import { useTranslation } from "@/lib/i18n";
import { useGenerationConfig } from "@/hooks/use-generation-config";
import { useChatActions } from "@/hooks/use-chat-actions";
import { BridgeManager, type CompatSandboxSnapshot } from "@/lib/compat-sandbox/bridge-manager";

export function CompatSandboxPanel() {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const managerRef = useRef<BridgeManager | null>(null);
  const rpcContextRef = useRef({
    currentChatId: null as number | null,
    selectedCharId: null as number | null,
    selectedCharName: "",
    messageCount: 0,
    globalVariables: {} as Record<string, string>,
    chatVariables: {} as Record<string, string>,
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);

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
  const globalVariables = useVariableStore((s) => s.globalVariables);
  const chatVariables = useVariableStore((s) => s.chatVariables);
  const activeBookIds = useWorldInfoStore((s) => s.activeBookIds);
  const globalScripts = useRegexStore((s) => s.globalScripts);
  const loadedGlobalScripts = useRegexStore((s) => s.loadedGlobalScripts);
  const loadingGlobalScripts = useRegexStore((s) => s.loading);
  const fetchGlobalScripts = useRegexStore((s) => s.fetchGlobalScripts);
  const { toggleSidebar } = useSidebar();

  const selectedChar = characters.find((character) => character.id === selectedId);
  const { generationConfig } = useGenerationConfig({
    connection,
    promptComponents,
    activeBookIds,
    selectedChar,
  });
  const { handleSend, runSlashCommand } = useChatActions({
    currentChatId,
    selectedId,
    generationConfig,
    sendMessage,
    continueMessage,
    impersonate,
    stopGeneration,
    swipe,
    deleteMessage,
    generateSwipe,
    refreshCurrentChat,
    selectChat,
    createChat,
    deleteChat,
    toggleSidebar,
    t,
  });

  useEffect(() => {
    void loadGlobalVariables();
  }, [loadGlobalVariables]);

  useEffect(() => {
    if (currentChatId) {
      void loadChatVariables(currentChatId);
    }
  }, [currentChatId, loadChatVariables]);

  useEffect(() => {
    if (!quickRepliesLoaded) {
      void loadQuickReplies();
    }
  }, [loadQuickReplies, quickRepliesLoaded]);

  useEffect(() => {
    if (!loadedGlobalScripts && !loadingGlobalScripts) {
      void fetchGlobalScripts();
    }
  }, [fetchGlobalScripts, loadedGlobalScripts, loadingGlobalScripts]);

  useEffect(() => {
    rpcContextRef.current = {
      currentChatId,
      selectedCharId: selectedChar?.id ?? null,
      selectedCharName: selectedChar?.name ?? "",
      messageCount: messages.length,
      globalVariables,
      chatVariables,
    };
  }, [
    chatVariables,
    currentChatId,
    globalVariables,
    messages.length,
    selectedChar?.id,
    selectedChar?.name,
  ]);

  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;

    managerRef.current?.dispose();
    managerRef.current = new BridgeManager(iframeRef.current, async (rpc) => {
      try {
        switch (rpc.method) {
          case "runSlashCommand":
            await runSlashCommand(String(rpc.params?.command ?? ""));
            managerRef.current?.reply(rpc.id, true);
            return;
          case "getContext":
            managerRef.current?.reply(rpc.id, {
              chatId: rpcContextRef.current.currentChatId,
              characterId: rpcContextRef.current.selectedCharId,
              characterName: rpcContextRef.current.selectedCharName,
              messageCount: rpcContextRef.current.messageCount,
            });
            return;
          case "getVariables":
            managerRef.current?.reply(rpc.id, {
              global: rpcContextRef.current.globalVariables,
              chat: rpcContextRef.current.chatVariables,
            });
            return;
          case "requestWriteDone":
            managerRef.current?.reply(rpc.id, {
              global: rpcContextRef.current.globalVariables,
              chat: rpcContextRef.current.chatVariables,
            });
            return;
        }
      } catch (error) {
        managerRef.current?.reply(
          rpc.id,
          undefined,
          error instanceof Error ? error.message : String(error),
        );
      }
    });
    managerRef.current.connect();

    return () => {
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, [iframeLoaded, runSlashCommand]);

  const snapshot = useMemo<CompatSandboxSnapshot | null>(() => {
    if (!currentChatId || !selectedChar) return null;

    const latestAssistantMessageId = [...messages]
      .reverse()
      .find((message) => message.role === "assistant")?.id;
    const isSwipeStreaming =
      isGenerating && (generationType === "swipe" || generationType === "regenerate");
    const streamingMessageId = isSwipeStreaming ? (latestAssistantMessageId ?? -1) : -1;

    return {
      chatId: currentChatId,
      character: selectedChar,
      messages,
      globalScripts,
      globalVariables,
      chatVariables,
      openUiEnabled: connection.openUiEnabled,
      streamingMessageId,
      streamingContent,
      streamingReasoning,
      streamingStructured,
    };
  }, [
    chatVariables,
    connection.openUiEnabled,
    currentChatId,
    generationType,
    globalScripts,
    globalVariables,
    isGenerating,
    messages,
    selectedChar,
    streamingContent,
    streamingReasoning,
    streamingStructured,
  ]);

  useEffect(() => {
    if (!snapshot || !managerRef.current) return;
    managerRef.current.sync(snapshot);
  }, [snapshot]);

  if (!selectedId || !currentChatId || !selectedChar) {
    return <ChatWelcomeScreen />;
  }

  const hasAssistantMessage = messages.some((message) => message.role === "assistant");

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-medium">{selectedChar.name ?? t("chat.defaultTitle")}</span>
      </div>

      <div className="min-h-0 flex-1 bg-background">
        <iframe
          ref={iframeRef}
          title="Compat Sandbox"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className="h-full w-full border-0"
          src="/compat-sandbox.html"
          onLoad={() => setIframeLoaded(true)}
        />
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
