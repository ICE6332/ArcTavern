import { z } from 'zod';

// --- Individual UI component schemas (mirror client/lib/openui/components.tsx props) ---

const TextComponentSchema = z.object({
  type: z.literal('Text'),
  content: z.string(),
});

const HeadingComponentSchema = z.object({
  type: z.literal('Heading'),
  text: z.string(),
  level: z.number().optional(),
});

const ItemListComponentSchema = z.object({
  type: z.literal('ItemList'),
  items: z.array(z.string()),
  ordered: z.boolean().optional(),
});

const DataTableComponentSchema = z.object({
  type: z.literal('DataTable'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const CodeBlockComponentSchema = z.object({
  type: z.literal('CodeBlock'),
  code: z.string(),
  language: z.string().optional(),
});

const AlertBoxComponentSchema = z.object({
  type: z.literal('AlertBox'),
  message: z.string(),
  variant: z.enum(['info', 'warning', 'error', 'success']).optional(),
});

const TagGroupComponentSchema = z.object({
  type: z.literal('TagGroup'),
  items: z.array(z.string()),
});

const ChoiceButtonsComponentSchema = z.object({
  type: z.literal('ChoiceButtons'),
  choices: z.array(z.object({ label: z.string(), value: z.string() })),
});

const DividerComponentSchema = z.object({
  type: z.literal('Divider'),
});

// Union of all UI children components
const ComponentUnionSchema = z.discriminatedUnion('type', [
  TextComponentSchema,
  HeadingComponentSchema,
  ItemListComponentSchema,
  DataTableComponentSchema,
  CodeBlockComponentSchema,
  AlertBoxComponentSchema,
  TagGroupComponentSchema,
  ChoiceButtonsComponentSchema,
  DividerComponentSchema,
]);

// --- Top-level block types ---

const NarrationBlockSchema = z.object({
  type: z.literal('narration'),
  content: z.string(),
});

const UICardBlockSchema = z.object({
  type: z.literal('ui'),
  title: z.string().nullable(),
  children: z.array(ComponentUnionSchema),
});

const BlockUnionSchema = z.discriminatedUnion('type', [
  NarrationBlockSchema,
  UICardBlockSchema,
]);

// --- Root schema for Output.object() ---

export const StructuredResponseSchema = z.object({
  blocks: z.array(BlockUnionSchema),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;
export type StructuredBlock = z.infer<typeof BlockUnionSchema>;
export type UIComponent = z.infer<typeof ComponentUnionSchema>;

// --- System prompt for structured output mode ---

export function getStructuredOutputSystemPrompt(): string {
  return `You respond with a JSON object containing a "blocks" array. Each block is one of:

1. Narration block — for roleplay, dialogue, descriptions, actions:
   { "type": "narration", "content": "..." }
   Use *asterisks* for actions and regular text for dialogue.

2. UI block — for structured content (tables, lists, code, alerts, choices):
   { "type": "ui", "title": "optional title", "children": [...] }

UI children component types:
- { "type": "Text", "content": "paragraph text" }
- { "type": "Heading", "text": "section title", "level": 2 }
- { "type": "ItemList", "items": ["item1", "item2"], "ordered": false }
- { "type": "DataTable", "headers": ["col1", "col2"], "rows": [["a", "b"]] }
- { "type": "CodeBlock", "code": "...", "language": "js" }
- { "type": "AlertBox", "message": "...", "variant": "info|warning|error|success" }
- { "type": "TagGroup", "items": ["tag1", "tag2"] }
- { "type": "ChoiceButtons", "choices": [{"label": "Option", "value": "opt"}] }
- { "type": "Divider" }

Guidelines:
- Use narration blocks for storytelling, dialogue, and descriptive text.
- Use UI blocks when structured layout adds clear value (data, reports, choices).
- You can freely mix both types in one response.
- Most responses should have at least one narration block.
- Use ChoiceButtons to give the user interactive options.
- Respond in the same language as the user.`;
}

// --- Utility: extract plain text from structured response for RAG/search ---

export function extractNarrationText(response: StructuredResponse): string {
  return response.blocks
    .filter((b): b is { type: 'narration'; content: string } => b.type === 'narration')
    .map((b) => b.content)
    .join('\n');
}
