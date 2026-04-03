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
      if (import.meta.env.DEV) {
        console.log("[bridge-client] window message:", event.data?.type, {
          hasPorts: !!event.ports?.[0],
        });
      }
      if (event.data?.type !== "compat:port-transfer" || !event.ports?.[0]) return;

      if (import.meta.env.DEV) {
        console.log("[bridge-client] port-transfer received, setting up port");
      }
      const port = event.ports[0];
      portRef.current = port;
      port.onmessage = (portEvent: MessageEvent<HostToSandboxMessage | SandboxToHostMessage>) => {
        const data = portEvent.data;
        if (!data) return;

        switch (data.type) {
          case "session:init":
            if (import.meta.env.DEV) {
              console.log("[bridge-client] session:init received", {
                chatId: data.payload.chatId,
                messageCount: data.payload.messages?.length,
              });
            }
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
            setState((current) => {
              const mid = data.payload.messageId;
              if (current.streamingMessageId !== mid) {
                return {
                  ...current,
                  streamingMessageId: mid,
                  streamingContent: data.payload.delta.content ?? "",
                  streamingReasoning: data.payload.delta.reasoning ?? "",
                  streamingStructured:
                    data.payload.delta.structured !== undefined
                      ? data.payload.delta.structured
                      : current.streamingStructured,
                };
              }
              const prevC = current.streamingContent;
              const prevR = current.streamingReasoning;
              const dC = data.payload.delta.content;
              const dR = data.payload.delta.reasoning;
              return {
                ...current,
                streamingMessageId: mid,
                streamingContent:
                  dC !== undefined && prevC.length > 0 && dC && !dC.startsWith(prevC)
                    ? `${prevC}${dC}`
                    : (dC ?? prevC),
                streamingReasoning:
                  dR !== undefined && prevR.length > 0 && dR && !dR.startsWith(prevR)
                    ? `${prevR}${dR}`
                    : (dR ?? prevR),
                streamingStructured:
                  data.payload.delta.structured !== undefined
                    ? data.payload.delta.structured
                    : current.streamingStructured,
              };
            });
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
                      isGenerating: data.payload.isGenerating ?? current.session.isGenerating,
                      generationType:
                        data.payload.generationType !== undefined
                          ? data.payload.generationType
                          : current.session.generationType,
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

    // Notify the host that the bridge client is ready to receive the port.
    window.parent.postMessage({ type: "compat:ready" }, "*");

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
