// TypeScript types mirroring server/src/modules/ai-provider/structured-output-schema.ts

export interface NarrationBlock {
  type: "narration";
  content: string;
}

export type UIComponent =
  | { type: "Text"; content: string }
  | { type: "Heading"; text: string; level?: number }
  | { type: "ItemList"; items: string[]; ordered?: boolean }
  | { type: "DataTable"; headers: string[]; rows: string[][] }
  | { type: "CodeBlock"; code: string; language?: string }
  | { type: "AlertBox"; message: string; variant?: "info" | "warning" | "error" | "success" }
  | { type: "TagGroup"; items: string[] }
  | { type: "ChoiceButtons"; choices: { label: string; value: string }[] }
  | { type: "Divider" };

export interface UICardBlock {
  type: "ui";
  title?: string | null;
  children: UIComponent[];
}

export type StructuredBlock = NarrationBlock | UICardBlock;

export interface StructuredResponse {
  blocks: StructuredBlock[];
}

/** Deep-partial version for streaming — all fields optional */
export type PartialUIComponent = Partial<UIComponent> & { type?: string };

export interface PartialUICardBlock {
  type?: "ui";
  title?: string | null;
  children?: PartialUIComponent[];
}

export interface PartialNarrationBlock {
  type?: "narration";
  content?: string;
}

export interface PartialStructuredResponse {
  blocks?: Array<PartialNarrationBlock | PartialUICardBlock | undefined>;
}

/** Check if an object looks like a structured response (has blocks array) */
export function isStructuredResponse(value: unknown): value is PartialStructuredResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "blocks" in value &&
    Array.isArray((value as PartialStructuredResponse).blocks)
  );
}
