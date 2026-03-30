"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { Task, TaskTrigger, TaskContent, TaskItem } from "@/components/ai-elements/task";
import { StatPanel } from "@/components/ai-elements/stat-panel";
import { GalleryGrid } from "@/components/ai-elements/gallery-grid";
import { motion } from "motion/react";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";
import type { BundledLanguage } from "shiki";

const blockTransition = { duration: 0.2, ease: "easeOut" as const };
const blockInitial = { opacity: 0, y: 6 };
const blockAnimate = { opacity: 1, y: 0 };

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2";

const alertColors: Record<string, string> = {
  info: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
  warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-300",
  error: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
  success: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
};

const quoteVariantClass: Record<string, string> = {
  default: "border-l-4 border-primary bg-muted/30 py-3 pl-4",
  muted: "border-l-2 border-muted-foreground/40 bg-muted/20 py-3 pl-3 text-muted-foreground",
  accent: "border border-accent/50 bg-accent/5 py-3 pl-4",
};

function rarityBadgeVariant(
  rarity: string | undefined,
): "default" | "secondary" | "outline" | "destructive" {
  if (!rarity) return "secondary";
  const r = rarity.toLowerCase();
  if (r.includes("legendary") || r.includes("神话") || r.includes("传奇")) return "default";
  if (r.includes("epic") || r.includes("史诗")) return "default";
  if (r.includes("rare") || r.includes("稀有")) return "secondary";
  if (r.includes("uncommon") || r.includes("优良")) return "outline";
  return "outline";
}

interface StructuredMessageProps {
  data: PartialStructuredResponse;
  isStreaming?: boolean;
  onAction?: (label: string, value: string) => void;
  onCommandAction?: (command: string) => void;
}

export function StructuredMessage({ data, onAction, onCommandAction }: StructuredMessageProps) {
  if (!data.blocks?.length) return null;

  return (
    <div className="space-y-4">
      {data.blocks.map((block, i) => {
        if (!block?.role) return null;

        const node = renderBlock(block, i, onAction, onCommandAction);
        if (!node) return null;
        return (
          <motion.div
            key={i}
            initial={blockInitial}
            animate={blockAnimate}
            transition={blockTransition}
          >
            {node}
          </motion.div>
        );
      })}
    </div>
  );
}

function renderBlock(
  block: NonNullable<PartialStructuredResponse["blocks"]>[number],
  i: number,
  onAction?: (label: string, value: string) => void,
  onCommandAction?: (command: string) => void,
): React.ReactNode {
  if (!block?.role) return null;

  if (block.role === "narration" && block.text) {
    return (
      <div className={markdownStyles}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
      </div>
    );
  }

  if (block.role === "card") {
    return (
      <Card size="sm">
        {block.title && (
          <CardHeader>
            <CardTitle>{block.title}</CardTitle>
          </CardHeader>
        )}
        {block.markdown && (
          <CardContent>
            <div className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.markdown}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  if (block.role === "alert" && block.message) {
    const cls = alertColors[block.level ?? "info"] ?? alertColors.info;
    return <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>{block.message}</div>;
  }

  if (block.role === "code" && block.content) {
    const lang = (block.language || "text") as BundledLanguage;
    return (
      <CodeBlock code={block.content} language={lang}>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>{lang}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    );
  }

  if (block.role === "choices" && block.options?.length) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {block.options.map((option, oi) => {
          if (typeof option === "string") {
            return (
              <Button
                key={oi}
                variant="outline"
                size="sm"
                onClick={() => onAction?.(option, option)}
              >
                {option}
              </Button>
            );
          }
          const variant =
            option.style === "primary"
              ? "default"
              : option.style === "danger"
                ? "destructive"
                : "outline";
          return (
            <Button
              key={oi}
              variant={variant}
              size="sm"
              onClick={() => onCommandAction?.(option.command)}
              title={option.command}
            >
              <span className="mr-1 text-xs opacity-60">⚡</span>
              {option.label}
            </Button>
          );
        })}
      </div>
    );
  }

  if (block.role === "separator") {
    return <Separator className="my-2" />;
  }

  if (block.role === "task" && block.title) {
    return (
      <Task>
        <TaskTrigger title={block.title} />
        {Array.isArray(block.items) && block.items.length && typeof block.items[0] === "string" ? (
          <TaskContent>
            {(block.items as string[]).map((item, ti) => (
              <TaskItem key={ti}>{item}</TaskItem>
            ))}
          </TaskContent>
        ) : null}
      </Task>
    );
  }

  if (block.role === "progress" && block.label) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{block.label}</span>
          <span>{block.value ?? 0}%</span>
        </div>
        <Progress value={block.value ?? 0} className="h-2" />
      </div>
    );
  }

  if (block.role === "tabs" && block.tabs?.length) {
    const defaultTab = "tab-0";
    return (
      <Tabs defaultValue={defaultTab} className="w-full text-xs">
        <TabsList className="w-full flex-wrap gap-1">
          {block.tabs.map((tab, ti) => (
            <TabsTrigger key={ti} value={`tab-${ti}`} className="px-2">
              {tab.label ?? `Tab ${ti + 1}`}
            </TabsTrigger>
          ))}
        </TabsList>
        {block.tabs.map((tab, ti) => (
          <TabsContent key={ti} value={`tab-${ti}`} className="mt-2">
            <div className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tab.content ?? ""}</ReactMarkdown>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  if (block.role === "accordion" && block.items?.length) {
    const accItems = block.items as { label: string; content: string }[];
    if (typeof accItems[0] !== "object" || accItems[0] == null || !("label" in accItems[0])) {
      return null;
    }
    return (
      <Accordion multiple className="w-full">
        {accItems.map((item, ai) => (
          <AccordionItem key={ai} value={`acc-${i}-${ai}`}>
            <AccordionTrigger>{item.label}</AccordionTrigger>
            <AccordionContent>
              <div className={markdownStyles}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content ?? ""}</ReactMarkdown>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  if (block.role === "stat" && block.stats?.length) {
    return (
      <StatPanel
        title={block.title}
        stats={block.stats.map((s) => ({
          name: s.name ?? "",
          value: s.value ?? 0,
          max: s.max,
        }))}
      />
    );
  }

  if (block.role === "quote" && block.text) {
    const v = block.variant ?? "default";
    const variantCls = quoteVariantClass[v] ?? quoteVariantClass.default;
    return (
      <div className={`rounded-md text-sm ${variantCls}`}>
        <blockquote className="not-italic">
          <div className={markdownStyles}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
          </div>
          {block.attribution ? (
            <footer className="mt-2 text-xs text-muted-foreground not-italic">
              — {block.attribution}
            </footer>
          ) : null}
        </blockquote>
      </div>
    );
  }

  if (block.role === "gallery" && block.items?.length) {
    const gItems = block.items as { src: string; alt?: string; caption?: string }[];
    if (typeof gItems[0] !== "object" || gItems[0] == null || !("src" in gItems[0])) {
      return null;
    }
    return <GalleryGrid items={gItems} columns={block.columns ?? 3} />;
  }

  if (block.role === "timeline" && block.events?.length) {
    return (
      <ul className="relative space-y-4 border-l border-border pl-4">
        {block.events.map((ev, ei) => (
          <li key={ei} className="relative">
            <span
              className="absolute top-1.5 -left-[calc(1rem+5px)] size-2.5 rounded-full border-2 border-background bg-primary"
              aria-hidden
            />
            {ev.time ? (
              <div className="text-[0.625rem] font-medium text-muted-foreground">{ev.time}</div>
            ) : null}
            {ev.title ? <div className="text-xs font-semibold">{ev.title}</div> : null}
            <div className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{ev.content ?? ""}</ReactMarkdown>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (block.role === "inventory" && block.items?.length) {
    const invItems = block.items as { name: string; quantity: number; rarity?: string }[];
    if (typeof invItems[0] !== "object" || invItems[0] == null || !("name" in invItems[0])) {
      return null;
    }
    return (
      <Card size="sm">
        <CardContent className="space-y-2 pt-4">
          {invItems.map((it, ii) => (
            <div
              key={ii}
              className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0"
            >
              <span className="font-medium">{it.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">×{it.quantity}</span>
                {it.rarity ? (
                  <Badge variant={rarityBadgeVariant(it.rarity)} className="text-[0.625rem]">
                    {it.rarity}
                  </Badge>
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (block.role === "spoiler" && block.content) {
    return (
      <Collapsible defaultOpen={false} className="rounded-md border border-border">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/50">
          <span>{block.label ?? "Spoiler"}</span>
          <span className="text-muted-foreground">▼</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-3 py-2">
            <div className={markdownStyles}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return null;
}
