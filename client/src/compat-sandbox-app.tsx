import { useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { useRegexStore } from "@/stores/regex-store";
import { useVariableStore } from "@/stores/variable-store";
import type { Message } from "@/lib/api/chat";
import type {
  CompatSandboxSnapshot,
  HostToSandboxMessage,
  SandboxToHostMessage,
} from "@/lib/compat-sandbox/protocol";

function useCompatSandboxBridge() {
  const portRef = useRef<MessagePort | null>(null);
  const pendingRef = useRef(
    new Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (reason?: unknown) => void;
      }
    >(),
  );
  const [snapshot, setSnapshot] = useState<CompatSandboxSnapshot | null>(null);

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type !== "compat:port-transfer" || !event.ports?.[0]) return;

      const port = event.ports[0];
      portRef.current = port;
      port.onmessage = (portEvent: MessageEvent<HostToSandboxMessage | SandboxToHostMessage>) => {
        const data = portEvent.data;
        if (!data) return;

        if (data.type === "session:update") {
          setSnapshot(data.payload);
          return;
        }

        if (data.type === "rpc:result") {
          const pending = pendingRef.current.get(data.id);
          if (!pending) return;
          pendingRef.current.delete(data.id);
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data.result);
          }
        }
      };
      port.start();
    };

    window.addEventListener("message", handleWindowMessage);
    return () => {
      window.removeEventListener("message", handleWindowMessage);
      portRef.current?.close();
      portRef.current = null;
    };
  }, []);

  const runSlashCommand = async (command: string) => {
    if (!portRef.current) return;

    const id = `sandbox-rpc-${crypto.randomUUID()}`;
    const result = new Promise<unknown>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
    });

    portRef.current.postMessage({
      type: "rpc:call",
      id,
      method: "runSlashCommand",
      params: { command },
    } satisfies SandboxToHostMessage);

    await result;
  };

  return { snapshot, runSlashCommand };
}

export function CompatSandboxApp() {
  const { snapshot, runSlashCommand } = useCompatSandboxBridge();

  useEffect(() => {
    if (!snapshot) return;

    useCharacterStore.setState({
      selectedId: snapshot.character.id,
      characters: [snapshot.character],
    });
    useChatStore.setState({
      currentChatId: snapshot.chatId,
      messages: snapshot.messages,
      isGenerating: snapshot.isGenerating,
      generationType: snapshot.generationType,
      streamingContent: snapshot.streamingContent,
      streamingReasoning: snapshot.streamingReasoning,
      streamingStructured: snapshot.streamingStructured,
      error: null,
    });
    useRegexStore.setState({
      globalScripts: snapshot.globalScripts,
      loadedGlobalScripts: true,
      loading: false,
    });
    useVariableStore.setState({
      globalVariables: snapshot.globalVariables,
      chatVariables: snapshot.chatVariables,
      currentChatId: snapshot.chatId,
    });
  }, [snapshot]);

  const latestAssistantMessageId = useMemo(() => {
    if (!snapshot) return null;
    for (let i = snapshot.messages.length - 1; i >= 0; i -= 1) {
      if (snapshot.messages[i].role === "assistant") return snapshot.messages[i].id;
    }
    return null;
  }, [snapshot]);

  if (!snapshot) {
    return <div className="p-4 text-sm text-muted-foreground">Loading compat runtime…</div>;
  }

  const isSwipeGenerating =
    snapshot.isGenerating &&
    (snapshot.generationType === "swipe" || snapshot.generationType === "regenerate");

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {snapshot.messages.map((message: Message) => {
          const isLastAssistant =
            message.role === "assistant" && message.id === latestAssistantMessageId;
          const showSwipeStreaming = isLastAssistant && isSwipeGenerating;

          return (
            <MessageBubble
              key={message.id}
              messageId={message.id}
              role={message.role}
              name={
                message.name || (message.role === "assistant" ? snapshot.character.name : undefined)
              }
              content={
                showSwipeStreaming
                  ? snapshot.streamingContent
                  : message.structuredContent
                    ? ""
                    : message.content
              }
              reasoning={
                showSwipeStreaming ? snapshot.streamingReasoning || undefined : message.reasoning
              }
              isStreaming={showSwipeStreaming}
              swipeId={message.swipeId}
              swipes={message.swipes}
              openUiEnabled={snapshot.openUiEnabled}
              structuredContent={
                showSwipeStreaming ? snapshot.streamingStructured : message.structuredContent
              }
              onStructuredAction={() => undefined}
              onStructuredCommandAction={() => undefined}
              onWidgetSlashCommand={runSlashCommand}
            />
          );
        })}

        {snapshot.isGenerating &&
          !isSwipeGenerating &&
          (snapshot.streamingContent ||
            snapshot.streamingReasoning ||
            snapshot.streamingStructured) && (
            <MessageBubble
              role="assistant"
              name={snapshot.character.name}
              content={snapshot.streamingContent}
              reasoning={snapshot.streamingReasoning}
              isStreaming
              openUiEnabled={snapshot.openUiEnabled}
              structuredContent={snapshot.streamingStructured}
              onStructuredAction={() => undefined}
              onStructuredCommandAction={() => undefined}
              onWidgetSlashCommand={runSlashCommand}
            />
          )}
      </div>
    </main>
  );
}
