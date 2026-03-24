import type { SlashCommand } from "../types"

function mathOp(
  name: string,
  helpString: string,
  fn: (a: number, b: number) => number,
): SlashCommand {
  return {
    name,
    callback: (_args, unnamed) => {
      const parts = unnamed.trim().split(/\s+/)
      const a = parseFloat(parts[0] ?? "0")
      const b = parseFloat(parts[1] ?? "0")
      const result = fn(a, b)
      return String(isNaN(result) ? 0 : result)
    },
    helpString,
    aliases: [],
    returns: "Numeric result",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "Two numbers separated by space", isRequired: true },
    ],
  }
}

function unaryMathOp(
  name: string,
  helpString: string,
  fn: (a: number) => number,
): SlashCommand {
  return {
    name,
    callback: (_args, unnamed) => {
      const a = parseFloat(unnamed.trim() || "0")
      const result = fn(a)
      return String(isNaN(result) ? 0 : result)
    },
    helpString,
    aliases: [],
    returns: "Numeric result",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "A number", isRequired: true },
    ],
  }
}

export const mathCommands: SlashCommand[] = [
  mathOp("add", "Add two numbers", (a, b) => a + b),
  mathOp("sub", "Subtract two numbers", (a, b) => a - b),
  mathOp("mul", "Multiply two numbers", (a, b) => a * b),
  mathOp("div", "Divide two numbers", (a, b) => (b === 0 ? 0 : a / b)),
  mathOp("mod", "Modulo of two numbers", (a, b) => (b === 0 ? 0 : a % b)),
  mathOp("pow", "Raise to power", (a, b) => a ** b),
  unaryMathOp("sin", "Sine of a number (radians)", Math.sin),
  unaryMathOp("cos", "Cosine of a number (radians)", Math.cos),
  unaryMathOp("log", "Natural logarithm", Math.log),
  unaryMathOp("round", "Round to nearest integer", Math.round),
  unaryMathOp("abs", "Absolute value", Math.abs),
  unaryMathOp("sqrt", "Square root", Math.sqrt),
  {
    name: "len",
    callback: (_args, unnamed) => String(unnamed.length),
    helpString: "Get string length",
    aliases: [],
    returns: "Length as number",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "String to measure", isRequired: true },
    ],
  },
  {
    name: "rand",
    callback: (_args, unnamed) => {
      const parts = unnamed.trim().split(/\s+/)
      const min = parseInt(parts[0] ?? "0", 10)
      const max = parseInt(parts[1] ?? "100", 10)
      return String(Math.floor(Math.random() * (max - min + 1)) + min)
    },
    helpString: "Generate a random integer between min and max",
    aliases: [],
    returns: "Random integer",
    namedArgumentList: [],
    unnamedArgumentList: [
      { description: "min max (default: 0 100)", isRequired: false },
    ],
  },
]
