"use client";

import { useEffect, useMemo, useRef } from "react";
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
import type {
  CompatSandboxSnapshot,
  HostToSandboxMessage,
  SandboxToHostMessage,
} from "@/lib/compat-sandbox/protocol";

export function CompatSandboxPanel() {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const portRef = useRef<MessagePort | null>(null);

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

  const selectedChar = characters.find((c) => c.id === selectedId);
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
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const channel = new MessageChannel();
    portRef.current?.close();
    portRef.current = channel.port1;

    channel.port1.onmessage = async (event: MessageEvent<SandboxToHostMessage>) => {
      const data = event.data;
      if (!data || data.type !== "rpc:call") return;

      if (data.method === "runSlashCommand") {
        try {
          await runSlashCommand(data.params.command);
          channel.port1.postMessage({
            type: "rpc:result",
            id: data.id,
            result: true,
          } satisfies SandboxToHostMessage);
        } catch (error) {
          channel.port1.postMessage({
            type: "rpc:result",
            id: data.id,
            error: error instanceof Error ? error.message : String(error),
          } satisfies SandboxToHostMessage);
        }
      }
    };

    iframe.contentWindow.postMessage({ type: "compat:port-transfer" }, "*", [channel.port2]);
    return () => {
      channel.port1.close();
      portRef.current = null;
    };
  }, [runSlashCommand]);

  const snapshot = useMemo<CompatSandboxSnapshot | null>(() => {
    if (!currentChatId || !selectedChar) return null;

    return {
      chatId: currentChatId,
      character: selectedChar,
      messages,
      globalScripts,
      globalVariables,
      chatVariables,
      openUiEnabled: connection.openUiEnabled,
      isGenerating,
      generationType,
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
    if (!snapshot || !portRef.current) return;

    portRef.current.postMessage({
      type: "session:update",
      payload: snapshot,
    } satisfies HostToSandboxMessage);
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
