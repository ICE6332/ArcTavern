"use client";

import { NativeChatPanel } from "./native-chat-panel";
import { CompatSandboxPanel } from "./compat-sandbox-panel";
import { useRuntimeMode } from "@/hooks/use-runtime-mode";

export function ChatPanelRouter() {
  const { runtimeMode } = useRuntimeMode();

  if (runtimeMode === "compat-sandbox") {
    return <CompatSandboxPanel />;
  }

  return <NativeChatPanel />;
}
