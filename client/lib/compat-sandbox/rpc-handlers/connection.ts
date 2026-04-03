/**
 * RPC handlers: connection/model settings (read-only).
 */

import { useConnectionStore } from "@/stores/connection-store";
import type { RpcHandler } from "../rpc-registry";

/** getConnectionSettings() */
export const getConnectionSettings: RpcHandler = () => {
  const s = useConnectionStore.getState();
  return {
    provider: s.provider,
    model: s.model,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    topP: s.topP,
    topK: s.topK,
    frequencyPenalty: s.frequencyPenalty,
    presencePenalty: s.presencePenalty,
    maxContext: s.maxContext,
    openUiEnabled: s.openUiEnabled,
  };
};

/** getProvider() */
export const getProvider: RpcHandler = () => {
  return useConnectionStore.getState().provider;
};

/** getModel() */
export const getModel: RpcHandler = () => {
  return useConnectionStore.getState().model;
};
