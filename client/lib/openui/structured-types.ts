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

export interface ChoiceAction {
  label: string;
  command: string;
  style?: "default" | "primary" | "danger";
}

export interface ChoicesBlock {
  role: "choices";
  options: (string | ChoiceAction)[];
}

export interface SeparatorBlock {
  role: "separator";
}

export interface TaskBlock {
  role: "task";
  title: string;
  items: string[];
}

export interface ProgressBlock {
  role: "progress";
  label: string;
  value: number;
}

export interface TabsBlock {
  role: "tabs";
  tabs: { label: string; content: string }[];
}

export interface AccordionBlock {
  role: "accordion";
  items: { label: string; content: string }[];
}

export interface StatBlock {
  role: "stat";
  title?: string;
  stats: { name: string; value: number | string; max?: number }[];
}

export interface QuoteBlock {
  role: "quote";
  text: string;
  attribution?: string;
  variant?: "default" | "muted" | "accent";
}

export interface GalleryBlock {
  role: "gallery";
  items: { src: string; alt?: string; caption?: string }[];
  columns?: 2 | 3 | 4;
}

export interface TimelineBlock {
  role: "timeline";
  events: { title?: string; time?: string; content: string }[];
}

export interface InventoryBlock {
  role: "inventory";
  items: { name: string; quantity: number; rarity?: string }[];
}

export interface SpoilerBlock {
  role: "spoiler";
  label?: string;
  content: string;
}

export type StructuredBlock =
  | NarrationBlock
  | CardBlock
  | AlertBlock
  | CodeBlock
  | ChoicesBlock
  | SeparatorBlock
  | TaskBlock
  | ProgressBlock
  | TabsBlock
  | AccordionBlock
  | StatBlock
  | QuoteBlock
  | GalleryBlock
  | TimelineBlock
  | InventoryBlock
  | SpoilerBlock;

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
  options?: (string | ChoiceAction)[];
  /** task: string[]; accordion/gallery/inventory: object arrays — disambiguate with role when rendering */
  items?:
    | string[]
    | { label: string; content: string }[]
    | { src: string; alt?: string; caption?: string }[]
    | { name: string; quantity: number; rarity?: string }[];
  value?: number;
  label?: string;
  tabs?: { label?: string; content?: string }[];
  stats?: { name?: string; value?: number | string; max?: number }[];
  attribution?: string;
  variant?: string;
  columns?: 2 | 3 | 4;
  events?: { title?: string; time?: string; content?: string }[];
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
