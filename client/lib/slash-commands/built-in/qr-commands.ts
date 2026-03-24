import type { SlashCommand } from "../types"
import { useQuickReplyStore } from "@/stores/quick-reply-store"
import { executeSlashCommand } from "../executor"

export const qrCommands: SlashCommand[] = [
  {
    name: "qr",
    callback: async (args, unnamed, ctx) => {
      const store = useQuickReplyStore.getState()
      const label = args.label ?? unnamed.trim()
      const message = args.message

      if (message) {
        // Create a new QR in the first set (or "Default" set)
        let targetSet = store.sets[0]
        if (!targetSet) {
          store.addSet("Default")
          targetSet = useQuickReplyStore.getState().sets[0]
        }
        if (targetSet) {
          store.addQr(targetSet.name, {
            label,
            message,
            isHidden: false,
            executeOnStartup: false,
            executeOnUser: false,
            executeOnAi: false,
            executeOnChatChange: false,
            executeOnNewChat: false,
            executeBeforeGeneration: false,
          })
        }
        return label
      }

      // Execute a QR by label
      for (const s of store.sets) {
        const qr = s.qrList.find(
          (q) => q.label.toLowerCase() === label.toLowerCase(),
        )
        if (qr) {
          const result = await executeSlashCommand(qr.message, ctx.chatId)
          return result.result
        }
      }
      return ""
    },
    helpString: "Execute or create a quick reply",
    aliases: [],
    returns: "QR result or label",
    namedArgumentList: [
      { name: "label", description: "QR button label", isRequired: false },
      { name: "message", description: "Slash command script (creates new QR)", isRequired: false },
    ],
    unnamedArgumentList: [
      { description: "QR label to execute", isRequired: false },
    ],
  },
  {
    name: "qr-set",
    callback: (args) => {
      const store = useQuickReplyStore.getState()
      const name = args.name ?? ""
      const action = args.action ?? "list"

      switch (action) {
        case "create":
          if (name) store.addSet(name)
          return name
        case "delete":
          if (name) store.removeSet(name)
          return ""
        case "list":
        default:
          return store.sets.map((s) => `${s.name} (${s.qrList.length} items)`).join("\n")
      }
    },
    helpString: "Manage quick reply sets",
    aliases: [],
    returns: "Set info",
    namedArgumentList: [
      { name: "name", description: "Set name", isRequired: false },
      {
        name: "action",
        description: "Action to perform",
        isRequired: false,
        defaultValue: "list",
        enumList: ["list", "create", "delete"],
      },
    ],
    unnamedArgumentList: [],
  },
]
