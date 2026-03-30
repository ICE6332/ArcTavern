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
  return `You respond with a JSON object containing a "blocks" array. Each block has a "role" field.

Block types:

1. narration — roleplay, dialogue, descriptions, inner thoughts:
   { "role": "narration", "text": "*action description* spoken dialogue" }

2. card — structured content rendered in a card. Use markdown for tables, lists, headings, etc:
   { "role": "card", "title": "Optional Title", "markdown": "## Heading\\n| Col | Val |\\n|---|---|\\n| HP | 100 |" }

3. alert — colored status message (level: info, warning, error, success):
   { "role": "alert", "message": "System online.", "level": "info" }

4. code — code snippet with optional language label:
   { "role": "code", "content": "console.log('hello')", "language": "javascript" }

5. choices — interactive option buttons the user can click:
   Simple text options: { "role": "choices", "options": ["Option A", "Option B"] }
   Action options (execute slash commands on click):
   { "role": "choices", "options": [{ "label": "Fight", "command": "/setvar key=action fight | /gen Describe the fight", "style": "primary" }] }
   You can mix simple strings and action objects in the same options array.

6. separator — horizontal line to separate sections:
   { "role": "separator" }

7. task — a collapsible task/checklist with a title and item list:
   { "role": "task", "title": "Setup Checklist", "items": ["Install dependencies", "Configure API keys", "Run tests"] }

8. progress — a progress bar showing completion or stats (value 0-100):
   { "role": "progress", "label": "HP", "value": 75 }

9. tabs — tabbed panels; each tab has a label and markdown content:
   { "role": "tabs", "tabs": [{ "label": "Combat", "content": "*Round 1*" }, { "label": "POV", "content": "Narration..." }] }

10. accordion — expandable sections with label and markdown content per item:
   { "role": "accordion", "items": [{ "label": "Spells", "content": "- Fireball\\n- Shield" }, { "label": "NPC", "content": "..." }] }

11. stat — character or combat stats; optional title; each stat has name, value (number or string), optional max for a bar:
   { "role": "stat", "title": "Hero", "stats": [{ "name": "HP", "value": 42, "max": 100 }, { "name": "MP", "value": 10, "max": 30 }] }

12. quote — quoted or emphasized text; optional attribution and variant (default, muted, accent):
   { "role": "quote", "text": "Thus spoke the oracle.", "attribution": "Ancient tome", "variant": "muted" }

13. gallery — image grid; optional columns 2–4:
   { "role": "gallery", "columns": 3, "items": [{ "src": "https://...", "alt": "Scene", "caption": "Forest" }] }

14. timeline — vertical timeline of events:
   { "role": "timeline", "events": [{ "time": "Day 1", "title": "Arrival", "content": "You reach the gate." }] }

15. inventory — item list with quantity and optional rarity label:
   { "role": "inventory", "items": [{ "name": "Health Potion", "quantity": 3, "rarity": "common" }] }

16. spoiler — hidden text; user expands to read (markdown in content):
   { "role": "spoiler", "label": "Ending", "content": "The twist is..." }

Guidelines:
- Use narration for storytelling, dialogue, and descriptive text. Write actions in *asterisks*.
- Use card for data tables, attribute panels, lists, or any rich content. Write the content as markdown.
- Use alert for status updates, warnings, or system messages that deserve visual emphasis.
- Use code for code snippets, logs, or terminal output.
- Use choices to offer the user interactive options.
- Use tabs for POV switches, combat phases, or categorized views; use accordion for long collapsible reference lists.
- Use stat for HP/MP bars and numeric panels; use quote for in-world quotations; use gallery for scene or character art references.
- Use timeline for quests or story beats; use inventory for loot and gear; use spoiler for plot spoilers.
- You can freely mix block types. Most responses should include at least one narration block.
- Respond in the same language as the user.`;
}

// --- Utility: extract plain text from structured response for RAG/search ---

export function extractNarrationText(response: StructuredResponse): string {
  return response.blocks
    .filter((b): b is { role: 'narration'; text: string } => b.role === 'narration')
    .map((b) => b.text)
    .join('\n');
}
