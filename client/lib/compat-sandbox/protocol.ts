import type { Character } from "@/lib/api/character";
import type { Message } from "@/lib/api/chat";
import type { RegexScriptData } from "@/lib/compat/regex-engine";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";

export interface CompatSandboxSession {
  chatId: number;
  character: Character;
  messages: Message[];
  globalScripts: RegexScriptData[];
  globalVariables: Record<string, string>;
  chatVariables: Record<string, string>;
  openUiEnabled: boolean;
}

export interface CompatStreamingDelta {
  content?: string;
  reasoning?: string;
  structured?: PartialStructuredResponse | null;
}

export type HostToSandboxMessage =
  | {
      type: "session:init";
      payload: CompatSandboxSession;
    }
  | {
      type: "message:upsert";
      payload: { message: Message };
    }
  | {
      type: "message:append";
      payload: {
        messageId: number;
        delta: CompatStreamingDelta;
      };
    }
  | {
      type: "message:finalize";
      payload: { messageId: number };
    }
  | {
      type: "vars:patch";
      payload: Partial<
        Pick<
          CompatSandboxSession,
          "character" | "globalScripts" | "globalVariables" | "chatVariables" | "openUiEnabled"
        >
      >;
    };

/**
 * RPC method name. Widened to `string` — the rpc-registry is the source of
 * truth for which methods are available, not this type.
 */
export type SandboxRpcMethod = string;

export type SandboxToHostMessage =
  | {
      type: "rpc:call";
      id: string;
      method: string;
      params?: Record<string, unknown>;
    }
  | {
      type: "rpc:result";
      id: string;
      result?: unknown;
      error?: string;
    };
