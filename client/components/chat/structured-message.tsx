"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  PartialStructuredResponse,
  PartialUIComponent,
} from "@/lib/openui/structured-types";

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

function UIComponentRenderer({
  comp,
  onAction,
}: {
  comp: PartialUIComponent;
  onAction?: (label: string, value: string) => void;
}) {
  if (!comp.type) return null;

  switch (comp.type) {
    case "Text":
      return "content" in comp && comp.content ? (
        <p className="leading-relaxed">{comp.content as string}</p>
      ) : null;

    case "Heading": {
      const text = "text" in comp ? (comp.text as string) : "";
      const level = "level" in comp ? (comp.level as number | undefined) : undefined;
      if (!text) return null;
      return level === 3 ? (
        <h3 className="text-sm font-semibold">{text}</h3>
      ) : (
        <h2 className="text-base font-semibold">{text}</h2>
      );
    }

    case "ItemList": {
      const items = "items" in comp ? (comp.items as string[] | undefined) : undefined;
      const ordered = "ordered" in comp ? (comp.ordered as boolean | undefined) : false;
      if (!items?.length) return null;
      const Tag = ordered ? "ol" : "ul";
      const cls = ordered ? "list-decimal pl-4" : "list-disc pl-4";
      return (
        <Tag className={cls}>
          {items.map((item, i) => (
            <li key={i} className="my-0.5">{item}</li>
          ))}
        </Tag>
      );
    }

    case "DataTable": {
      const headers = "headers" in comp ? (comp.headers as string[] | undefined) : undefined;
      const rows = "rows" in comp ? (comp.rows as string[][] | undefined) : undefined;
      if (!headers?.length) return null;
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "CodeBlock": {
      const code = "code" in comp ? (comp.code as string) : "";
      const language = "language" in comp ? (comp.language as string | undefined) : undefined;
      if (!code) return null;
      return (
        <div className="overflow-x-auto rounded-md bg-muted p-3">
          {language && (
            <span className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
              {language}
            </span>
          )}
          <pre className="text-xs"><code>{code}</code></pre>
        </div>
      );
    }

    case "AlertBox": {
      const message = "message" in comp ? (comp.message as string) : "";
      const variant = "variant" in comp ? (comp.variant as string | undefined) : "info";
      if (!message) return null;
      const colors: Record<string, string> = {
        info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
        warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300",
        error: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
        success: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
      };
      const cls = colors[variant ?? "info"] ?? colors.info;
      return (
        <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
          {message}
        </div>
      );
    }

    case "TagGroup": {
      const items = "items" in comp ? (comp.items as string[] | undefined) : undefined;
      if (!items?.length) return null;
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.map((label, i) => (
            <Badge key={i} variant="secondary">{label}</Badge>
          ))}
        </div>
      );
    }

    case "ChoiceButtons": {
      const choices = "choices" in comp
        ? (comp.choices as { label: string; value: string }[] | undefined)
        : undefined;
      if (!choices?.length) return null;
      return (
        <div className="flex flex-wrap gap-1.5">
          {choices.map((choice, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onAction?.(choice.label, choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      );
    }

    case "Divider":
      return <Separator className="my-2" />;

    default:
      return null;
  }
}

interface StructuredMessageProps {
  data: PartialStructuredResponse;
  isStreaming?: boolean;
  onAction?: (label: string, value: string) => void;
}

export function StructuredMessage({ data, isStreaming, onAction }: StructuredMessageProps) {
  if (!data.blocks?.length) return null;

  return (
    <div className="space-y-4">
      {data.blocks.map((block, i) => {
        if (!block?.type) return null;

        if (block.type === "narration") {
          const content = "content" in block ? block.content : undefined;
          if (!content) return null;
          return (
            <div key={i} className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {content}
              </ReactMarkdown>
            </div>
          );
        }

        if (block.type === "ui") {
          const title = "title" in block ? block.title : undefined;
          const children = "children" in block ? block.children : undefined;
          return (
            <Card key={i} size="sm">
              {title && (
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
              )}
              <CardContent className="space-y-3">
                {children?.map((child, ci) =>
                  child ? (
                    <UIComponentRenderer key={ci} comp={child} onAction={onAction} />
                  ) : null,
                )}
              </CardContent>
            </Card>
          );
        }

        return null;
      })}
    </div>
  );
}
