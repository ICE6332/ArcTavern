import { useEffect, useMemo } from "react";
import type { Message } from "@/lib/api/chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useBridgeClient } from "@/lib/compat-sandbox/bridge-client";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { useRegexStore } from "@/stores/regex-store";
import { useVariableStore } from "@/stores/variable-store";

export function CompatSandboxApp() {
  const { state, call } = useBridgeClient();

  useEffect(() => {
    if (!state.session) return;

    useCharacterStore.setState({
      selectedId: state.session.character.id,
      characters: [state.session.character],
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
    return <div className="p-4 text-sm text-muted-foreground">Loading compat runtime…</div>;
  }

  const session = state.session;

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
            <MessageBubble
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

        {state.streamingMessageId === -1 &&
          (state.streamingContent || state.streamingReasoning || state.streamingStructured) && (
            <MessageBubble
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
      </div>
    </main>
  );
}
