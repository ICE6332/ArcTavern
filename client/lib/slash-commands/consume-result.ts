import type { ExecutionResult } from "./types";

type DisplayKind = "info" | "error";

export interface SlashCommandResultHandlers {
  onDisplay: (text: string, kind?: DisplayKind) => void;
  onSendMessage: (content: string) => Promise<void> | void;
  onImpersonate: () => Promise<void> | void;
  onContinue: () => Promise<void> | void;
  onStop: () => Promise<void> | void;
  onDeleteCurrentChat?: () => Promise<void> | void;
  onCloseChat?: () => Promise<void> | void;
  onTogglePanels?: () => void;
  onRefreshChat?: () => Promise<void> | void;
}

export async function consumeSlashCommandResult(
  result: ExecutionResult,
  handlers: SlashCommandResultHandlers,
): Promise<void> {
  if (result.error) {
    handlers.onDisplay(result.error, "error");
    return;
  }

  const value = result.result;
  if (!value) return;

  if (value.startsWith("__echo__:")) {
    handlers.onDisplay(value.slice("__echo__:".length));
    return;
  }

  if (value.startsWith("__gen__:")) {
    await handlers.onSendMessage(value.slice("__gen__:".length));
    return;
  }

  if (value.startsWith("__impersonate__:")) {
    await handlers.onImpersonate();
    return;
  }

  if (value === "__continue__") {
    await handlers.onContinue();
    return;
  }

  if (value === "__stop__") {
    await handlers.onStop();
    return;
  }

  if (value === "__delete_chat__") {
    if (handlers.onDeleteCurrentChat) {
      await handlers.onDeleteCurrentChat();
    } else {
      handlers.onDisplay("Deleting the current chat is not supported here.", "error");
    }
    return;
  }

  if (value.startsWith("__renamechat__:")) {
    handlers.onDisplay("Renaming chats is not supported yet.", "error");
    return;
  }

  if (value === "__closechat__") {
    if (handlers.onCloseChat) {
      await handlers.onCloseChat();
    } else {
      handlers.onDisplay("Closing the current chat is not supported here.", "error");
    }
    return;
  }

  if (value === "__tempchat__") {
    handlers.onDisplay("Temporary chats are not supported yet.", "error");
    return;
  }

  if (value === "__panels__") {
    if (handlers.onTogglePanels) {
      handlers.onTogglePanels();
    } else {
      handlers.onDisplay("Toggling panels is not supported here.", "error");
    }
    return;
  }

  if (value.startsWith("__refresh_chat__")) {
    if (handlers.onRefreshChat) {
      await handlers.onRefreshChat();
    }

    const message = value.slice("__refresh_chat__:".length);
    if (message) {
      handlers.onDisplay(message);
    }
    return;
  }

  if (result.outputMode === "send") {
    await handlers.onSendMessage(value);
    return;
  }

  if (result.outputMode === "display" || !value.startsWith("__")) {
    handlers.onDisplay(value);
    return;
  }

  handlers.onDisplay(`Unsupported command result: ${value}`, "error");
}
