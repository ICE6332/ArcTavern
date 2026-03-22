import { defineComponent, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// --- Leaf components (no children refs) ---

export const Text = defineComponent({
  name: "Text",
  description: "A paragraph of text content.",
  props: z.object({
    content: z.string(),
  }),
  component: ({ props }) => <p className="leading-relaxed">{props.content}</p>,
});

export const Heading = defineComponent({
  name: "Heading",
  description: "A section heading. Use level 2 for main sections, 3 for subsections.",
  props: z.object({
    text: z.string(),
    level: z.number().optional(),
  }),
  component: ({ props }) => {
    const cls = props.level === 3 ? "text-sm font-semibold" : "text-base font-semibold";
    if (props.level === 3) {
      return <h3 className={cls}>{props.text}</h3>;
    }
    return <h2 className={cls}>{props.text}</h2>;
  },
});

export const ItemList = defineComponent({
  name: "ItemList",
  description: "A bulleted or numbered list of text items.",
  props: z.object({
    items: z.array(z.string()),
    ordered: z.boolean().optional(),
  }),
  component: ({ props }) => {
    const Tag = props.ordered ? "ol" : "ul";
    const cls = props.ordered ? "list-decimal pl-4" : "list-disc pl-4";
    return (
      <Tag className={cls}>
        {props.items.map((item, i) => (
          <li key={i} className="my-0.5">
            {item}
          </li>
        ))}
      </Tag>
    );
  },
});

export const DataTable = defineComponent({
  name: "DataTable",
  description:
    "A data table with headers and rows. Use for structured comparisons or tabular data.",
  props: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  component: ({ props }) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {props.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
});

export const CodeBlock = defineComponent({
  name: "CodeBlock",
  description: "A code snippet block with optional language label.",
  props: z.object({
    code: z.string(),
    language: z.string().optional(),
  }),
  component: ({ props }) => (
    <div className="overflow-x-auto rounded-md bg-muted p-3">
      {props.language && (
        <span className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
          {props.language}
        </span>
      )}
      <pre className="text-xs">
        <code>{props.code}</code>
      </pre>
    </div>
  ),
});

export const AlertBox = defineComponent({
  name: "AlertBox",
  description: "A status message. Variant: info, warning, error, or success.",
  props: z.object({
    message: z.string(),
    variant: z.enum(["info", "warning", "error", "success"]).optional(),
  }),
  component: ({ props }) => {
    const colors: Record<string, string> = {
      info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
      warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300",
      error: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
      success: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
    };
    const cls = colors[props.variant ?? "info"] ?? colors.info;
    return <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>{props.message}</div>;
  },
});

export const TagGroup = defineComponent({
  name: "TagGroup",
  description: "A group of tags/badges displayed inline.",
  props: z.object({
    items: z.array(z.string()),
  }),
  component: ({ props }) => (
    <div className="flex flex-wrap gap-1.5">
      {props.items.map((label, i) => (
        <Badge key={i} variant="secondary">
          {label}
        </Badge>
      ))}
    </div>
  ),
});

function ChoiceButtonsRenderer({
  props,
}: {
  props: { choices: { label: string; value: string }[] };
}) {
  const triggerAction = useTriggerAction();
  return (
    <div className="flex flex-wrap gap-1.5">
      {props.choices.map((choice, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          onClick={() =>
            triggerAction(choice.label, undefined, {
              type: "continue_conversation",
              params: { value: choice.value },
            })
          }
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}

export const ChoiceButtons = defineComponent({
  name: "ChoiceButtons",
  description:
    "Interactive choice buttons. When clicked, sends the choice label as a user message.",
  props: z.object({
    choices: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
  }),
  component: ChoiceButtonsRenderer,
});

export const Divider = defineComponent({
  name: "Divider",
  description: "A horizontal line separator between sections.",
  props: z.object({}),
  component: () => <Separator className="my-2" />,
});

// --- Container component (uses child refs) ---

const ContentChildUnion = z.union([
  Text.ref,
  Heading.ref,
  ItemList.ref,
  DataTable.ref,
  CodeBlock.ref,
  AlertBox.ref,
  TagGroup.ref,
  ChoiceButtons.ref,
  Divider.ref,
]);

export const UICard = defineComponent({
  name: "UICard",
  description:
    "Root container for structured content. Wraps children in a card layout. Always use as the root component.",
  props: z.object({
    title: z.string().optional(),
    children: z.array(ContentChildUnion),
  }),
  component: ({ props, renderNode }) => (
    <Card size="sm">
      {props.title && (
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-3">{renderNode(props.children)}</CardContent>
    </Card>
  ),
});
