import { useEffect, useMemo } from "react";
import type { Message } from "@/lib/api/chat";
import { CompatSandboxMessageView } from "@/components/chat/compat-sandbox-message-view";
import { DotsLoader } from "@/components/ui/loader";
import { useBridgeClient } from "@/lib/compat-sandbox/bridge-client";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { useRegexStore } from "@/stores/regex-store";
import { useVariableStore } from "@/stores/variable-store";

export function CompatSandboxApp() {
  const { state, call } = useBridgeClient();

  useEffect(() => {
    if (!state.session) return;

    const char = state.session.character;
    if (import.meta.env.DEV) {
      console.log("[compat-sandbox] session:init character", char.name, {
        hasExtensions: !!char.extensions,
        regexScriptCount: Array.isArray(char.extensions?.regex_scripts)
          ? char.extensions.regex_scripts.length
          : 0,
        extensionKeys: char.extensions ? Object.keys(char.extensions) : [],
      });
    }

    useCharacterStore.setState({
      selectedId: char.id,
      characters: [char],
    });
    useChatStore.setState({
      currentChatId: state.session.chatId,
      messages: state.session.messages,
      error: null,
    });
    useRegexStore.setState({
      globalScripts: state.session.globalScripts,
      loadedGlobalScripts: true,
      loading: false,
    });
    useVariableStore.setState({
      globalVariables: state.session.globalVariables,
      chatVariables: state.session.chatVariables,
      currentChatId: state.session.chatId,
    });
  }, [state.session]);

  const latestAssistantMessageId = useMemo(() => {
    if (!state.session) return null;
    for (let index = state.session.messages.length - 1; index >= 0; index -= 1) {
      if (state.session.messages[index].role === "assistant") {
        return state.session.messages[index].id;
      }
    }
    return null;
  }, [state.session]);

  if (!state.session) {
    return null;
  }

  const session = state.session;

  const isSwipeGenerating =
    session.isGenerating &&
    (session.generationType === "swipe" || session.generationType === "regenerate");

  const runSlashCommand = async (command: string) => {
    await call("runSlashCommand", { command });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {state.session.messages.map((message: Message) => {
          const showStreaming =
            state.streamingMessageId === message.id && message.id === latestAssistantMessageId;

          return (
            <CompatSandboxMessageView
              key={message.id}
              messageId={message.id}
              role={message.role}
              name={
                message.name || (message.role === "assistant" ? session.character.name : undefined)
              }
              content={
                showStreaming
                  ? state.streamingContent
                  : message.structuredContent
                    ? ""
                    : message.content
              }
              reasoning={showStreaming ? state.streamingReasoning || undefined : message.reasoning}
              isStreaming={showStreaming}
              swipeId={message.swipeId}
              swipes={message.swipes}
              openUiEnabled={session.openUiEnabled}
              structuredContent={
                showStreaming ? state.streamingStructured : message.structuredContent
              }
              onStructuredAction={() => undefined}
              onStructuredCommandAction={() => undefined}
              onWidgetSlashCommand={runSlashCommand}
            />
          );
        })}

        {session.isGenerating &&
          !isSwipeGenerating &&
          (state.streamingContent || state.streamingReasoning || state.streamingStructured) && (
            <CompatSandboxMessageView
              role="assistant"
              name={state.session.character.name}
              content={state.streamingContent}
              reasoning={state.streamingReasoning}
              isStreaming
              openUiEnabled={session.openUiEnabled}
              structuredContent={state.streamingStructured}
              onStructuredAction={() => undefined}
              onStructuredCommandAction={() => undefined}
              onWidgetSlashCommand={runSlashCommand}
            />
          )}

        {session.isGenerating &&
          !isSwipeGenerating &&
          !state.streamingContent &&
          !state.streamingReasoning &&
          !state.streamingStructured && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {state.session.character.name ?? "Assistant"}
              </p>
              <DotsLoader size="md" className="text-muted-foreground" />
            </div>
          )}
      </div>
    </main>
  );
}
