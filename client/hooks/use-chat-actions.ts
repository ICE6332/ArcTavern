import { useCallback } from "react";
import type { ActionEvent } from "@openuidev/react-lang";
import { toast } from "@/lib/toast";
import { executeSlashCommand } from "@/lib/slash-commands/executor";
import { consumeSlashCommandResult } from "@/lib/slash-commands/consume-result";
import { useChatStore } from "@/stores/chat-store";

interface ChatActionsDeps<TGenerationConfig extends Record<string, unknown>> {
  currentChatId: number | null;
  selectedId: number | null;
  generationConfig: TGenerationConfig;
  sendMessage: (content: string, config: TGenerationConfig) => Promise<void>;
  continueMessage: (config: TGenerationConfig) => Promise<void>;
  impersonate: (config: TGenerationConfig) => Promise<void>;
  stopGeneration: () => Promise<void>;
  swipe: (messageId: number, direction: "left" | "right") => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  generateSwipe: (config: TGenerationConfig) => Promise<void>;
  refreshCurrentChat: () => Promise<void>;
  selectChat: (chatId: number | null) => Promise<void>;
  createChat: (characterId: number, name?: string) => Promise<{ id: number }>;
  deleteChat: (chatId: number) => Promise<void>;
  toggleSidebar: () => void;
  t: (key: string) => string;
}

export function useChatActions<TGenerationConfig extends Record<string, unknown>>({
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
}: ChatActionsDeps<TGenerationConfig>) {
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
        displayCommandOutput(t("chat.openChatBeforeSlash"), "error");
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
      t,
      toggleSidebar,
    ],
  );

  return {
    displayCommandOutput,
    handleOpenUiAction,
    handleSend,
    handleSwipe,
    handleDeleteMessage,
    handleStructuredAction,
    handleGenerateSwipe,
    runSlashCommand,
  };
}
