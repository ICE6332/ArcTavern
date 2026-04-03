import type { Character } from "@/lib/api/character";
import type { Message } from "@/lib/api/chat";
import type { RegexScriptData } from "@/lib/compat/regex-engine";
import type { GenerationType } from "@/lib/api/types";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";

export interface CompatSandboxSnapshot {
  chatId: number;
  character: Character;
  messages: Message[];
  globalScripts: RegexScriptData[];
  globalVariables: Record<string, string>;
  chatVariables: Record<string, string>;
  openUiEnabled: boolean;
  isGenerating: boolean;
  generationType: GenerationType | null;
  streamingContent: string;
  streamingReasoning: string;
  streamingStructured: PartialStructuredResponse | null;
}

export type HostToSandboxMessage = {
  type: "session:update";
  payload: CompatSandboxSnapshot;
};

export type SandboxToHostMessage =
  | {
      type: "rpc:call";
      id: string;
      method: "runSlashCommand";
      params: { command: string };
    }
  | {
      type: "rpc:result";
      id: string;
      result?: unknown;
      error?: string;
    };
