import type { SlashCommand } from "../types"
import { executeBody } from "../executor"
import { getVariable } from "../variables"

type CompareRule = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "not"

function compare(left: string, right: string, rule: CompareRule): boolean {
  const numLeft = parseFloat(left)
  const numRight = parseFloat(right)
  const bothNumeric = !isNaN(numLeft) && !isNaN(numRight)

  switch (rule) {
    case "eq":
      return bothNumeric ? numLeft === numRight : left === right
    case "neq":
      return bothNumeric ? numLeft !== numRight : left !== right
    case "gt":
      return bothNumeric ? numLeft > numRight : left > right
    case "gte":
      return bothNumeric ? numLeft >= numRight : left >= right
    case "lt":
      return bothNumeric ? numLeft < numRight : left < right
    case "lte":
      return bothNumeric ? numLeft <= numRight : left <= right
    case "in":
      return right.includes(left)
    case "nin":
      return !right.includes(left)
    case "not":
      return !left || left === "0" || left === "false" || left === "undefined"
    default:
      return false
  }
}

const MAX_LOOP_ITERATIONS = 100

export const flowCommands: SlashCommand[] = [
  {
    name: "if",
    callback: async (args, _unnamed, ctx) => {
      const left = args.left ?? ""
      const right = args.right ?? ""
      const rule = (args.rule ?? "eq") as CompareRule
      const bodyContent = args.__body ?? ""

      if (compare(left, right, rule)) {
        if (bodyContent) {
          return executeBody(bodyContent, ctx)
        }
      }
      return ""
    },
    helpString: "Conditional execution",
    aliases: [],
    returns: "Result of the body if condition is true",
    namedArgumentList: [
      { name: "left", description: "Left operand", isRequired: true },
      { name: "right", description: "Right operand", isRequired: true },
      {
        name: "rule",
        description: "Comparison rule",
        isRequired: false,
        defaultValue: "eq",
        enumList: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin", "not"],
      },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "while",
    callback: async (args, _unnamed, ctx) => {
      const rule = (args.rule ?? "eq") as CompareRule
      const bodyContent = args.__body ?? ""
      let result = ""
      let iterations = 0

      while (iterations < MAX_LOOP_ITERATIONS) {
        // Re-evaluate left/right each iteration (they may reference variables)
        const left = getVariable(args.left ?? "", ctx) ?? args.left ?? ""
        const right = getVariable(args.right ?? "", ctx) ?? args.right ?? ""

        if (!compare(left, right, rule)) break
        if (bodyContent) {
          result = await executeBody(bodyContent, ctx)
        }
        if (ctx.aborted) break
        iterations++
      }

      return result
    },
    helpString: "Loop while condition is true (max 100 iterations)",
    aliases: [],
    returns: "Result of the last iteration",
    namedArgumentList: [
      { name: "left", description: "Left operand", isRequired: true },
      { name: "right", description: "Right operand", isRequired: true },
      {
        name: "rule",
        description: "Comparison rule",
        isRequired: false,
        defaultValue: "eq",
        enumList: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin", "not"],
      },
    ],
    unnamedArgumentList: [],
  },
  {
    name: "times",
    callback: async (args, unnamed, ctx) => {
      const count = Math.min(parseInt(unnamed || args.count || "0", 10), MAX_LOOP_ITERATIONS)
      const bodyContent = args.__body ?? ""
      let result = ""

      for (let i = 0; i < count; i++) {
        if (ctx.aborted) break
        // Set {{index}} for use in body
        ctx.variables.set("index", String(i))
        if (bodyContent) {
          result = await executeBody(bodyContent, ctx)
        }
      }

      return result
    },
    helpString: "Repeat body N times (max 100)",
    aliases: [],
    returns: "Result of the last iteration",
    namedArgumentList: [
      { name: "count", description: "Number of iterations", isRequired: false },
    ],
    unnamedArgumentList: [
      { description: "Number of iterations", isRequired: false },
    ],
  },
]
