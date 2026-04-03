/**
 * RPC handlers: AI generation control.
 */

import { useChatStore } from "@/stores/chat-store";
import type { RpcHandler } from "../rpc-registry";

/** isGenerating() */
export const isGenerating: RpcHandler = () => {
  return useChatStore.getState().isGenerating;
};

/** stopGeneration() */
export const stopGeneration: RpcHandler = async () => {
  await useChatStore.getState().stopGeneration();
  return true;
};

/**
 * generate({ type?, message? })
 *
 * Triggers a generation through the native chat store. The generation config
 * is not passed from the script — it uses whatever the user has configured
 * in the connection settings. Scripts can only control the type and message.
 *
 * This is intentionally limited: we don't expose the full GenerationConfig
 * to prevent scripts from overriding the user's provider/model settings.
 */
export const generate: RpcHandler = async (params) => {
  const type = typeof params.type === "string" ? params.type : "normal";
  const message = typeof params.message === "string" ? params.message : undefined;
  const store = useChatStore.getState();

  if (store.isGenerating) {
    throw new Error("Generation already in progress");
  }

  // Delegate to the store's sendMessage for normal type, which handles
  // the full config internally. For other types we'd need the config
  // which is only available in the React component layer.
  // For now, only "normal" is supported from scripts.
  if (type === "normal" && message) {
    // We can't call sendMessage directly because it requires GenerationConfig.
    // Instead, signal that we want generation by returning the intent —
    // the host component will handle it.
    return { intent: "generate", type, message };
  }

  return { intent: "generate", type, message };
};

/** getGenerationType() */
export const getGenerationType: RpcHandler = () => {
  return useChatStore.getState().generationType;
};

/** getStreamingContent() */
export const getStreamingContent: RpcHandler = () => {
  const store = useChatStore.getState();
  return {
    content: store.streamingContent,
    reasoning: store.streamingReasoning,
    isGenerating: store.isGenerating,
  };
};
