"use client";

import { buildGenerationConfig } from "@/hooks/use-generation-config";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { useConnectionStore } from "@/stores/connection-store";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { useWorldInfoStore } from "@/stores/world-info-store";
import type { RpcHandler } from "../rpc-registry";

function getCurrentGenerationConfig() {
  const { selectedId, characters } = useCharacterStore.getState();
  const selectedChar = characters.find((character) => character.id === selectedId);

  return buildGenerationConfig({
    connection: useConnectionStore.getState(),
    promptComponents: usePromptManagerStore.getState().components,
    activeBookIds: useWorldInfoStore.getState().activeBookIds,
    selectedChar,
  }).generationConfig;
}

export const isGenerating: RpcHandler = () => {
  return useChatStore.getState().isGenerating;
};

export const stopGeneration: RpcHandler = async () => {
  await useChatStore.getState().stopGeneration();
  return true;
};

/**
 * generate({ type?, message? })
 *
 * Triggers generation through the host chat store using the current
 * connection, prompt, and world-info state from Zustand.
 */
export const generate: RpcHandler = async (params) => {
  const type = typeof params.type === "string" ? params.type : "normal";
  const message = typeof params.message === "string" ? params.message : undefined;
  const store = useChatStore.getState();

  if (store.isGenerating) {
    throw new Error("Generation already in progress");
  }

  const generationConfig = getCurrentGenerationConfig();

  switch (type) {
    case "normal": {
      const trimmedMessage = message?.trim();
      if (!trimmedMessage) {
        throw new Error("Generation message is required");
      }
      await store.sendMessage(trimmedMessage, generationConfig);
      return true;
    }
    case "continue":
      await store.continueMessage(generationConfig);
      return true;
    case "impersonate":
      await store.impersonate(generationConfig);
      return true;
    case "swipe":
      await store.generateSwipe(generationConfig);
      return true;
    case "regenerate":
      await store.regenerate(generationConfig);
      return true;
    default:
      throw new Error(`Unsupported generation type: ${type}`);
  }
};

export const getGenerationType: RpcHandler = () => {
  return useChatStore.getState().generationType;
};

export const getStreamingContent: RpcHandler = () => {
  const store = useChatStore.getState();
  return {
    content: store.streamingContent,
    reasoning: store.streamingReasoning,
    isGenerating: store.isGenerating,
  };
};
