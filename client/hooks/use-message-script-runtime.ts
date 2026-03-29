"use client";

import { useEffect } from "react";
import { chatApi } from "@/lib/api/chat";
import {
  createCompatApiBindings,
  SandboxRuntime,
  type CompatApiDeps,
} from "@/lib/compat/js-runtime";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";

/**
 * Runs extracted assistant <script> blocks in a soft sandbox when the message is shown.
 * Variables persist via message.extra (see CompatApiDeps).
 */
export function useMessageScriptRuntime(options: {
  messageId?: number;
  swipeId: number;
  scripts: string[];
  enabled: boolean;
  swipesLength: number;
}): void {
  const { messageId, swipeId, scripts, enabled, swipesLength } = options;
  const scriptsFingerprint = scripts.join("\x1e");

  useEffect(() => {
    if (!enabled || !messageId || scripts.length === 0) return;

    const msg = useChatStore.getState().messages.find((m) => m.id === messageId);
    if (!msg) return;

    const len = Math.max(swipesLength, msg.swipes.length, swipeId + 1, 1);

    const deps: CompatApiDeps = {
      swipeId,
      swipesLength: len,
      getExtra: () => {
        const m = useChatStore.getState().messages.find((x) => x.id === messageId);
        return m?.extra ?? {};
      },
      persistExtra: async (nextExtra) => {
        const updated = await chatApi.updateMessage(messageId, { extra: nextExtra });
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? updated : m)),
        }));
      },
      getMessages: (count?: number) => {
        const list = useChatStore.getState().messages;
        const slice = count !== undefined ? list.slice(-count) : [...list];
        return slice.map((m) => ({ role: m.role, content: m.content }));
      },
      getCharName: () => {
        const id = useCharacterStore.getState().selectedId;
        if (!id) return "";
        const c = useCharacterStore.getState().characters.find((x) => x.id === id);
        return c?.name ?? "";
      },
      getCharAvatar: () => {
        const id = useCharacterStore.getState().selectedId;
        if (!id) return "";
        const c = useCharacterStore.getState().characters.find((x) => x.id === id);
        return c?.avatar ?? "";
      },
    };

    const runtime = new SandboxRuntime();
    const bindings = createCompatApiBindings(deps);
    for (const script of scripts) {
      runtime.run(script, bindings);
    }

    return () => {
      runtime.destroy();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- scriptsFingerprint tracks script bodies
  }, [enabled, messageId, swipeId, swipesLength, scriptsFingerprint]);
}
