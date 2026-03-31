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

export type SandboxRpcMethod =
  | "runSlashCommand"
  | "getContext"
  | "getVariables"
  | "requestWriteDone";

export type SandboxToHostMessage =
  | {
      type: "rpc:call";
      id: string;
      method: SandboxRpcMethod;
      params?: Record<string, unknown>;
    }
  | {
      type: "rpc:result";
      id: string;
      result?: unknown;
      error?: string;
    };
