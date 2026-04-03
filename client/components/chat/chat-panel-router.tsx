"use client";

import { useEffect } from "react";
import { NativeChatPanel } from "./native-chat-panel";
import { CompatSandboxPanel } from "./compat-sandbox-panel";
import { useRuntimeMode } from "@/hooks/use-runtime-mode";

const COMPAT_SANDBOX_PREFETCH_ID = "arctravern-compat-sandbox-prefetch";

export function ChatPanelRouter() {
  const { runtimeMode } = useRuntimeMode();

  useEffect(() => {
    if (runtimeMode !== "compat-sandbox") return;
    if (document.getElementById(COMPAT_SANDBOX_PREFETCH_ID)) return;
    const link = document.createElement("link");
    link.id = COMPAT_SANDBOX_PREFETCH_ID;
    link.rel = "prefetch";
    link.href = "/compat-sandbox.html";
    link.as = "document";
    document.head.appendChild(link);
  }, [runtimeMode]);

  if (runtimeMode === "compat-sandbox") {
    return <CompatSandboxPanel />;
  }

  return <NativeChatPanel />;
}
