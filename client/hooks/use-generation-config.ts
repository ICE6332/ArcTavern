import { useMemo } from "react";
import { getOpenUiSystemPrompt } from "@/lib/openui";
import type { PromptComponent } from "@/stores/prompt-manager-store";
import type { CustomApiFormat } from "@/stores/connection-store";
import type { Provider } from "@/lib/api/types";

export interface ConnectionConfig {
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  frequencyPenalty: number;
  presencePenalty: number;
  reverseProxy: string;
  maxContext: number;
  openUiEnabled: boolean;
  customApiFormat: CustomApiFormat;
}

export interface SelectedCharacterRef {
  worldInfoBookId?: number | null;
}

interface GenerationConfigArgs {
  connection: ConnectionConfig;
  promptComponents: PromptComponent[];
  activeBookIds: number[];
  selectedChar?: SelectedCharacterRef;
}

export function buildGenerationConfig({
  connection,
  promptComponents,
  activeBookIds,
  selectedChar,
}: GenerationConfigArgs) {
  const openUiEnabled = connection.openUiEnabled;

  const promptOrder = [...promptComponents]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ identifier: c.id, enabled: c.enabled }));
  if (openUiEnabled) {
    promptOrder.push({ identifier: "openui_instructions", enabled: true });
  }

  const customPrompts = promptComponents
    .filter((c) => c.enabled && c.content !== undefined && c.content.trim() !== "")
    .map((c) => ({
      identifier: c.id,
      role: c.role,
      content: c.content!,
    }));
  if (openUiEnabled) {
    customPrompts.push({
      identifier: "openui_instructions",
      role: "system" as const,
      content: getOpenUiSystemPrompt(),
    });
  }

  const generationConfig = {
    provider: connection.provider,
    model: connection.model,
    temperature: connection.temperature,
    maxTokens: connection.maxTokens,
    topP: connection.topP,
    // Gemini via @ai-sdk/google does not accept unified `topK`; omit on the wire (server also strips).
    topK:
      connection.provider === "google" ||
      (connection.provider === "custom" && connection.customApiFormat === "google")
        ? undefined
        : connection.topK,
    frequencyPenalty: connection.frequencyPenalty,
    presencePenalty: connection.presencePenalty,
    reverseProxy: connection.reverseProxy || undefined,
    maxContext: connection.maxContext,
    promptOrder,
    customPrompts,
    structuredOutput: openUiEnabled,
    customApiFormat: connection.provider === "custom" ? connection.customApiFormat : undefined,
    worldInfoBookIds: (() => {
      const ids = [...activeBookIds];
      const charBookId = selectedChar?.worldInfoBookId;
      if (charBookId && !ids.includes(charBookId)) ids.unshift(charBookId);
      return ids.length > 0 ? ids : undefined;
    })(),
  };

  return { generationConfig, promptOrder, customPrompts };
}

export function useGenerationConfig(args: GenerationConfigArgs) {
  return useMemo(
    () => buildGenerationConfig(args),
    [
      args.activeBookIds,
      args.connection.customApiFormat,
      args.connection.frequencyPenalty,
      args.connection.maxContext,
      args.connection.maxTokens,
      args.connection.model,
      args.connection.openUiEnabled,
      args.connection.presencePenalty,
      args.connection.provider,
      args.connection.reverseProxy,
      args.connection.temperature,
      args.connection.topK,
      args.connection.topP,
      args.promptComponents,
      args.selectedChar?.worldInfoBookId,
    ],
  );
}
