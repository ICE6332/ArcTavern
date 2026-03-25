import { useMemo } from "react";
import { getOpenUiSystemPrompt } from "@/lib/openui";
import type { PromptComponent } from "@/stores/prompt-manager-store";
import type { CustomApiFormat } from "@/stores/connection-store";
import type { Provider } from "@/lib/api/types";

interface ConnectionConfig {
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

interface SelectedCharacterRef {
  worldInfoBookId?: number | null;
}

export function useGenerationConfig({
  connection,
  promptComponents,
  activeBookIds,
  selectedChar,
}: {
  connection: ConnectionConfig;
  promptComponents: PromptComponent[];
  activeBookIds: number[];
  selectedChar?: SelectedCharacterRef;
}) {
  const openUiEnabled = connection.openUiEnabled;

  const promptOrder = useMemo(() => {
    const order = [...promptComponents]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ identifier: c.id, enabled: c.enabled }));
    if (openUiEnabled) {
      order.push({ identifier: "openui_instructions", enabled: true });
    }
    return order;
  }, [promptComponents, openUiEnabled]);

  const customPrompts = useMemo(() => {
    const prompts = promptComponents
      .filter((c) => c.enabled && c.content !== undefined && c.content.trim() !== "")
      .map((c) => ({
        identifier: c.id,
        role: c.role,
        content: c.content!,
      }));
    if (openUiEnabled) {
      prompts.push({
        identifier: "openui_instructions",
        role: "system" as const,
        content: getOpenUiSystemPrompt(),
      });
    }
    return prompts;
  }, [promptComponents, openUiEnabled]);

  const generationConfig = useMemo(
    () => ({
      provider: connection.provider,
      model: connection.model,
      temperature: connection.temperature,
      maxTokens: connection.maxTokens,
      topP: connection.topP,
      topK: connection.topK,
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
    }),
    [
      activeBookIds,
      connection.customApiFormat,
      connection.frequencyPenalty,
      connection.maxContext,
      connection.maxTokens,
      connection.model,
      connection.presencePenalty,
      connection.provider,
      connection.reverseProxy,
      connection.temperature,
      connection.topK,
      connection.topP,
      customPrompts,
      openUiEnabled,
      promptOrder,
      selectedChar?.worldInfoBookId,
    ],
  );

  return { generationConfig, promptOrder, customPrompts };
}
