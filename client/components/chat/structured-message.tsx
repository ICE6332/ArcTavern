"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2";

const alertColors: Record<string, string> = {
  info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
  warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300",
  error: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
  success: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
};

interface StructuredMessageProps {
  data: PartialStructuredResponse;
  isStreaming?: boolean;
  onAction?: (label: string) => void;
}

export function StructuredMessage({ data, isStreaming, onAction }: StructuredMessageProps) {
  if (!data.blocks?.length) return null;

  return (
    <div className="space-y-4">
      {data.blocks.map((block, i) => {
        if (!block?.role) return null;

        if (block.role === "narration" && block.text) {
          return (
            <div key={i} className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {block.text}
              </ReactMarkdown>
            </div>
          );
        }

        if (block.role === "card") {
          return (
            <Card key={i} size="sm">
              {block.title && (
                <CardHeader>
                  <CardTitle>{block.title}</CardTitle>
                </CardHeader>
              )}
              {block.markdown && (
                <CardContent>
                  <div className={markdownStyles}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {block.markdown}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        }

        if (block.role === "alert" && block.message) {
          const cls = alertColors[block.level ?? "info"] ?? alertColors.info;
          return (
            <div key={i} className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
              {block.message}
            </div>
          );
        }

        if (block.role === "code" && block.content) {
          return (
            <div key={i} className="overflow-x-auto rounded-md bg-muted p-3">
              {block.language && (
                <span className="mb-1 block text-[0.625rem] font-medium text-muted-foreground">
                  {block.language}
                </span>
              )}
              <pre className="text-xs">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.role === "choices" && block.options?.length) {
          return (
            <div key={i} className="flex flex-wrap gap-1.5">
              {block.options.map((option, oi) => (
                <Button key={oi} variant="outline" size="sm" onClick={() => onAction?.(option)}>
                  {option}
                </Button>
              ))}
            </div>
          );
        }

        if (block.role === "separator") {
          return <Separator key={i} className="my-2" />;
        }

        return null;
      })}
    </div>
  );
}
