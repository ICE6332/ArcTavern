import type { Character } from "@/lib/api/character";
import type { Message } from "@/lib/api/chat";
import type {
  CompatSandboxSession,
  CompatStreamingDelta,
  HostToSandboxMessage,
  SandboxToHostMessage,
} from "./protocol";

export interface CompatSandboxSnapshot extends CompatSandboxSession {
  streamingMessageId: number;
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: CompatStreamingDelta["structured"];
}

function sameMessage(a: Message, b: Message): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffStreaming(
  previous: CompatSandboxSnapshot | null,
  next: CompatSandboxSnapshot,
): CompatStreamingDelta | null {
  const prevContent = previous?.streamingContent ?? "";
  const prevReasoning = previous?.streamingReasoning ?? "";
  const prevStructured = previous?.streamingStructured ?? null;

  if (
    next.streamingContent === prevContent &&
    next.streamingReasoning === prevReasoning &&
    next.streamingStructured === prevStructured
  ) {
    return null;
  }

  return {
    content:
      next.streamingContent.startsWith(prevContent) &&
      next.streamingContent.length >= prevContent.length
        ? next.streamingContent.slice(prevContent.length)
        : next.streamingContent,
    reasoning:
      next.streamingReasoning.startsWith(prevReasoning) &&
      next.streamingReasoning.length >= prevReasoning.length
        ? next.streamingReasoning.slice(prevReasoning.length)
        : next.streamingReasoning,
    structured: next.streamingStructured,
  };
}

export class BridgeManager {
  private port: MessagePort | null = null;
  private snapshot: CompatSandboxSnapshot | null = null;

  constructor(
    private readonly iframe: HTMLIFrameElement,
    private readonly onRpcCall: (
      payload: Extract<SandboxToHostMessage, { type: "rpc:call" }>,
    ) => Promise<void>,
  ) {}

  connect() {
    const contentWindow = this.iframe.contentWindow;
    if (!contentWindow) return;

    const channel = new MessageChannel();
    this.port?.close();
    this.port = channel.port1;
    this.port.onmessage = (event: MessageEvent<SandboxToHostMessage>) => {
      const data = event.data;
      if (!data || data.type !== "rpc:call") return;
      void this.onRpcCall(data);
    };
    this.port.start();

    contentWindow.postMessage({ type: "compat:port-transfer" }, "*", [channel.port2]);
  }

  dispose() {
    this.port?.close();
    this.port = null;
    this.snapshot = null;
  }

  reply(id: string, result?: unknown, error?: string) {
    if (!this.port) return;
    this.port.postMessage({
      type: "rpc:result",
      id,
      result,
      error,
    } satisfies SandboxToHostMessage);
  }

  sync(next: CompatSandboxSnapshot) {
    if (!this.port) return;

    if (!this.snapshot) {
      this.port.postMessage({
        type: "session:init",
        payload: {
          chatId: next.chatId,
          character: next.character,
          messages: next.messages,
          globalScripts: next.globalScripts,
          globalVariables: next.globalVariables,
          chatVariables: next.chatVariables,
          openUiEnabled: next.openUiEnabled,
        },
      } satisfies HostToSandboxMessage);
      this.snapshot = next;
      return;
    }

    if (this.snapshot.character.id !== next.character.id) {
      this.snapshot = null;
      this.sync(next);
      return;
    }

    if (
      JSON.stringify(this.snapshot.globalScripts) !== JSON.stringify(next.globalScripts) ||
      JSON.stringify(this.snapshot.globalVariables) !== JSON.stringify(next.globalVariables) ||
      JSON.stringify(this.snapshot.chatVariables) !== JSON.stringify(next.chatVariables) ||
      this.snapshot.openUiEnabled !== next.openUiEnabled ||
      JSON.stringify(this.snapshot.character) !== JSON.stringify(next.character)
    ) {
      this.port.postMessage({
        type: "vars:patch",
        payload: {
          character: next.character as Character,
          globalScripts: next.globalScripts,
          globalVariables: next.globalVariables,
          chatVariables: next.chatVariables,
          openUiEnabled: next.openUiEnabled,
        },
      } satisfies HostToSandboxMessage);
    }

    const previousMessages = new Map(
      this.snapshot.messages.map((message) => [message.id, message]),
    );
    let requiresFullReset = next.messages.length < this.snapshot.messages.length;

    if (!requiresFullReset) {
      for (const message of next.messages) {
        const previousMessage = previousMessages.get(message.id);
        if (!previousMessage || !sameMessage(previousMessage, message)) {
          this.port.postMessage({
            type: "message:upsert",
            payload: { message },
          } satisfies HostToSandboxMessage);
        }
      }
    }

    if (requiresFullReset) {
      this.snapshot = null;
      this.sync(next);
      return;
    }

    const delta = diffStreaming(this.snapshot, next);
    if (
      delta &&
      (delta.content || delta.reasoning || delta.structured !== undefined) &&
      (next.streamingContent || next.streamingReasoning || next.streamingStructured)
    ) {
      this.port.postMessage({
        type: "message:append",
        payload: {
          messageId: next.streamingMessageId,
          delta,
        },
      } satisfies HostToSandboxMessage);
    }

    if (
      this.snapshot.streamingContent ||
      this.snapshot.streamingReasoning ||
      this.snapshot.streamingStructured
    ) {
      if (!next.streamingContent && !next.streamingReasoning && !next.streamingStructured) {
        this.port.postMessage({
          type: "message:finalize",
          payload: {
            messageId: this.snapshot.streamingMessageId,
          },
        } satisfies HostToSandboxMessage);
      }
    }

    this.snapshot = next;
  }
}
