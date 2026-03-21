// Flat block types matching server structured-output-schema.ts

export interface NarrationBlock {
  role: "narration";
  text: string;
}

export interface CardBlock {
  role: "card";
  title?: string;
  markdown: string;
}

export interface AlertBlock {
  role: "alert";
  message: string;
  level?: "info" | "warning" | "error" | "success";
}

export interface CodeBlock {
  role: "code";
  content: string;
  language?: string;
}

export interface ChoicesBlock {
  role: "choices";
  options: string[];
}

export interface SeparatorBlock {
  role: "separator";
}

export type StructuredBlock =
  | NarrationBlock
  | CardBlock
  | AlertBlock
  | CodeBlock
  | ChoicesBlock
  | SeparatorBlock;

export interface StructuredResponse {
  blocks: StructuredBlock[];
}

/** Partial version for streaming */
export interface PartialBlock {
  role?: string;
  text?: string;
  title?: string;
  markdown?: string;
  message?: string;
  level?: string;
  content?: string;
  language?: string;
  options?: string[];
}

export interface PartialStructuredResponse {
  blocks?: PartialBlock[];
}

/** Check if an object looks like a structured response */
export function isStructuredResponse(value: unknown): value is PartialStructuredResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "blocks" in value &&
    Array.isArray((value as PartialStructuredResponse).blocks)
  );
}
