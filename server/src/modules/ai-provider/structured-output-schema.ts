import { z } from 'zod';

// --- Flat block schemas (no nesting, Gemini-compatible) ---

const NarrationBlockSchema = z.object({
  role: z.literal('narration'),
  text: z.string(),
});

const CardBlockSchema = z.object({
  role: z.literal('card'),
  title: z.string().optional(),
  markdown: z.string(),
});

const AlertBlockSchema = z.object({
  role: z.literal('alert'),
  message: z.string(),
  level: z.enum(['info', 'warning', 'error', 'success']).optional(),
});

const CodeBlockSchema = z.object({
  role: z.literal('code'),
  content: z.string(),
  language: z.string().optional(),
});

const ChoiceActionSchema = z.object({
  label: z.string(),
  command: z.string(),
  style: z.enum(['default', 'primary', 'danger']).optional(),
});

const ChoicesBlockSchema = z.object({
  role: z.literal('choices'),
  options: z.array(z.union([z.string(), ChoiceActionSchema])),
});

const SeparatorBlockSchema = z.object({
  role: z.literal('separator'),
});

const TaskBlockSchema = z.object({
  role: z.literal('task'),
  title: z.string(),
  items: z.array(z.string()),
});

const ProgressBlockSchema = z.object({
  role: z.literal('progress'),
  label: z.string(),
  value: z.number(),
});

const TabsBlockSchema = z.object({
  role: z.literal('tabs'),
  tabs: z.array(
    z.object({
      label: z.string(),
      content: z.string(),
    }),
  ),
});

const AccordionBlockSchema = z.object({
  role: z.literal('accordion'),
  items: z.array(
    z.object({
      label: z.string(),
      content: z.string(),
    }),
  ),
});

const StatBlockSchema = z.object({
  role: z.literal('stat'),
  title: z.string().optional(),
  stats: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.number(), z.string()]),
      max: z.number().optional(),
    }),
  ),
});

const QuoteBlockSchema = z.object({
  role: z.literal('quote'),
  text: z.string(),
  attribution: z.string().optional(),
  variant: z.enum(['default', 'muted', 'accent']).optional(),
});

const GalleryBlockSchema = z.object({
  role: z.literal('gallery'),
  items: z.array(
    z.object({
      src: z.string(),
      alt: z.string().optional(),
      caption: z.string().optional(),
    }),
  ),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

const TimelineBlockSchema = z.object({
  role: z.literal('timeline'),
  events: z.array(
    z.object({
      title: z.string().optional(),
      time: z.string().optional(),
      content: z.string(),
    }),
  ),
});

const InventoryBlockSchema = z.object({
  role: z.literal('inventory'),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      rarity: z.string().optional(),
    }),
  ),
});

const SpoilerBlockSchema = z.object({
  role: z.literal('spoiler'),
  label: z.string().optional(),
  content: z.string(),
});

const BlockSchema = z.discriminatedUnion('role', [
  NarrationBlockSchema,
  CardBlockSchema,
  AlertBlockSchema,
  CodeBlockSchema,
  ChoicesBlockSchema,
  SeparatorBlockSchema,
  TaskBlockSchema,
  ProgressBlockSchema,
  TabsBlockSchema,
  AccordionBlockSchema,
  StatBlockSchema,
  QuoteBlockSchema,
  GalleryBlockSchema,
  TimelineBlockSchema,
  InventoryBlockSchema,
  SpoilerBlockSchema,
]);

// --- Root schema for Output.object() ---

export const StructuredResponseSchema = z.object({
  blocks: z.array(BlockSchema),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;
export type StructuredBlock = z.infer<typeof BlockSchema>;

// --- System prompt for structured output mode ---

export function getStructuredOutputSystemPrompt(): string {
  return `Return ONE valid JSON object only: { "blocks": [ ... ] }.

Each block must use one of these roles with the correct fields:
- narration: { "role": "narration", "text": string }
- card: { "role": "card", "markdown": string, "title"?: string }
- alert: { "role": "alert", "message": string, "level"?: "info"|"warning"|"error"|"success" }
- code: { "role": "code", "content": string, "language"?: string }
- choices: { "role": "choices", "options": string[] | action[] }
- separator: { "role": "separator" }
- task: { "role": "task", "title": string, "items": string[] }
- progress: { "role": "progress", "label": string, "value": number }
- tabs: { "role": "tabs", "tabs": [{ "label": string, "content": string }] }
- accordion: { "role": "accordion", "items": [{ "label": string, "content": string }] }
- stat: { "role": "stat", "title"?: string, "stats": [{ "name": string, "value": string|number, "max"?: number }] }
- quote: { "role": "quote", "text": string, "attribution"?: string, "variant"?: "default"|"muted"|"accent" }
- gallery: { "role": "gallery", "items": [{ "src": string, "alt"?: string, "caption"?: string }], "columns"?: 2|3|4 }
- timeline: { "role": "timeline", "events": [{ "title"?: string, "time"?: string, "content": string }] }
- inventory: { "role": "inventory", "items": [{ "name": string, "quantity": number, "rarity"?: string }] }
- spoiler: { "role": "spoiler", "content": string, "label"?: string }

Usage guidance:
- Use narration for story, dialogue, description, and inner thoughts. Write actions in *asterisks*.
- Use card as the default visual support block. If unsure what UI block to use, use card.
- Use choices for interactive options.
- Use alert, stat, task, tabs, accordion, timeline, inventory, quote, gallery, progress, code, or spoiler when they clearly fit.
- Respond in the same language as the user.

CRITICAL:
- The first non-whitespace character MUST be "{".
- No prose, markdown fences, or explanations outside the JSON object.
- Story and dialogue must live inside blocks, not as raw text outside JSON.
- Every response MUST include at least 2 blocks.
- Every response MUST include at least 1 narration block.
- Every response MUST include at least 1 visual UI block in addition to narration.
- Valid visual UI blocks are: card, alert, code, task, progress, tabs, accordion, stat, quote, gallery, timeline, inventory, spoiler.
- choices and separator DO NOT satisfy the visual UI block requirement.
- Even if the user only wants story progression or a simple reply, you STILL MUST include a visual UI block. Use card by default.
- NEVER return only narration.
- NEVER return only choices.
- NEVER return narration + choices only.
- NEVER return narration + separator only.

BAD:
{ "blocks": [{ "role": "narration", "text": "..." }] }

GOOD:
{ "blocks": [
  { "role": "narration", "text": "..." },
  { "role": "card", "title": "Scene", "markdown": "..." }
] }`;
}

// --- Utility: extract plain text from structured response for RAG/search ---

export function extractNarrationText(response: StructuredResponse): string {
  return response.blocks
    .filter((b): b is { role: 'narration'; text: string } => b.role === 'narration')
    .map((b) => b.text)
    .join('\n');
}
