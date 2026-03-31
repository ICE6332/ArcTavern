import { useEffect, useRef, useState } from "react";
import type { CompatSandboxSession, HostToSandboxMessage, SandboxToHostMessage } from "./protocol";

export interface CompatSandboxBridgeState {
  session: CompatSandboxSession | null;
  streamingMessageId: number;
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: HostToSandboxMessage extends infer T
    ? T extends { type: "message:append"; payload: { delta: infer D } }
      ? D extends { structured?: infer S }
        ? S
        : null
      : null
    : null;
}

export function useBridgeClient() {
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
  const [state, setState] = useState<CompatSandboxBridgeState>({
    session: null,
    streamingMessageId: -1,
    streamingContent: "",
    streamingReasoning: "",
    streamingStructured: null,
  });

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type !== "compat:port-transfer" || !event.ports?.[0]) return;

      const port = event.ports[0];
      portRef.current = port;
      port.onmessage = (portEvent: MessageEvent<HostToSandboxMessage | SandboxToHostMessage>) => {
        const data = portEvent.data;
        if (!data) return;

        switch (data.type) {
          case "session:init":
            setState({
              session: data.payload,
              streamingMessageId: -1,
              streamingContent: "",
              streamingReasoning: "",
              streamingStructured: null,
            });
            break;
          case "message:upsert":
            setState((current) => {
              if (!current.session) return current;
              const nextMessages = current.session.messages.some(
                (message) => message.id === data.payload.message.id,
              )
                ? current.session.messages.map((message) =>
                    message.id === data.payload.message.id ? data.payload.message : message,
                  )
                : [...current.session.messages, data.payload.message];
              const shouldClearStreaming =
                current.streamingMessageId === -1 &&
                data.payload.message.role === "assistant" &&
                data.payload.message.content.length > 0;
              return {
                ...current,
                session: {
                  ...current.session,
                  messages: nextMessages,
                },
                streamingMessageId: shouldClearStreaming ? -1 : current.streamingMessageId,
                streamingContent: shouldClearStreaming ? "" : current.streamingContent,
                streamingReasoning: shouldClearStreaming ? "" : current.streamingReasoning,
                streamingStructured: shouldClearStreaming ? null : current.streamingStructured,
              };
            });
            break;
          case "message:append":
            setState((current) => ({
              ...current,
              streamingMessageId: data.payload.messageId,
              streamingContent:
                data.payload.delta.content !== undefined &&
                current.streamingMessageId === data.payload.messageId &&
                current.streamingContent &&
                data.payload.delta.content &&
                !data.payload.delta.content.startsWith(current.streamingContent)
                  ? `${current.streamingContent}${data.payload.delta.content}`
                  : (data.payload.delta.content ?? current.streamingContent),
              streamingReasoning:
                data.payload.delta.reasoning !== undefined &&
                current.streamingMessageId === data.payload.messageId &&
                current.streamingReasoning &&
                data.payload.delta.reasoning &&
                !data.payload.delta.reasoning.startsWith(current.streamingReasoning)
                  ? `${current.streamingReasoning}${data.payload.delta.reasoning}`
                  : (data.payload.delta.reasoning ?? current.streamingReasoning),
              streamingStructured:
                data.payload.delta.structured !== undefined
                  ? data.payload.delta.structured
                  : current.streamingStructured,
            }));
            break;
          case "message:finalize":
            setState((current) =>
              current.streamingMessageId !== data.payload.messageId
                ? current
                : {
                    ...current,
                    streamingMessageId: -1,
                    streamingContent: "",
                    streamingReasoning: "",
                    streamingStructured: null,
                  },
            );
            break;
          case "vars:patch":
            setState((current) =>
              current.session
                ? {
                    ...current,
                    session: {
                      ...current.session,
                      ...data.payload,
                      character: data.payload.character ?? current.session.character,
                      globalScripts: data.payload.globalScripts ?? current.session.globalScripts,
                      globalVariables:
                        data.payload.globalVariables ?? current.session.globalVariables,
                      chatVariables: data.payload.chatVariables ?? current.session.chatVariables,
                      openUiEnabled: data.payload.openUiEnabled ?? current.session.openUiEnabled,
                    },
                  }
                : current,
            );
            break;
          case "rpc:result": {
            const pending = pendingRef.current.get(data.id);
            if (!pending) return;
            pendingRef.current.delete(data.id);
            if (data.error) {
              pending.reject(new Error(data.error));
            } else {
              pending.resolve(data.result);
            }
            break;
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

  const call = async (
    method: Extract<SandboxToHostMessage, { type: "rpc:call" }>["method"],
    params?: Record<string, unknown>,
  ) => {
    if (!portRef.current) return undefined;

    const id = `sandbox-rpc-${crypto.randomUUID()}`;
    const result = new Promise<unknown>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
    });

    portRef.current.postMessage({
      type: "rpc:call",
      id,
      method,
      params,
    } satisfies SandboxToHostMessage);

    return result;
  };

  return { state, call };
}
