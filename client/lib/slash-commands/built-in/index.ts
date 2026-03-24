import { registry } from "../registry";
import { varCommands } from "./var-commands";
import { mathCommands } from "./math-commands";
import { flowCommands } from "./flow-commands";
import { chatCommands } from "./chat-commands";
import { genCommands } from "./gen-commands";
import { charCommands } from "./char-commands";
import { uiCommands } from "./ui-commands";
import { qrCommands } from "./qr-commands";

const allCommands = [
  ...varCommands,
  ...mathCommands,
  ...flowCommands,
  ...chatCommands,
  ...genCommands,
  ...charCommands,
  ...uiCommands,
  ...qrCommands,
];

let registered = false;

/**
 * Register all built-in slash commands with the global registry.
 * Safe to call multiple times (idempotent).
 */
export function registerBuiltInCommands(): void {
  if (registered) return;
  for (const cmd of allCommands) {
    registry.register(cmd);
  }
  registered = true;
}
