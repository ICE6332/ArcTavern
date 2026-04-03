"use client";

import { lazy, Suspense } from "react";
import { useTranslation } from "@/lib/i18n";
import { isOpenUiLang } from "@/lib/openui";
import type { PartialStructuredResponse } from "@/lib/openui/structured-types";
import type { ActionEvent } from "@openuidev/react-lang";
import { DotsLoader } from "@/components/ui/loader";
import { useContentPreprocessor } from "@/hooks/use-content-preprocessor";
import { useMessageScriptRuntime } from "@/hooks/use-message-script-runtime";
import { CompatMarkdown } from "@/lib/compat/markdown-pipeline";
import { prepareMessageViewModel } from "@/lib/compat/message-view-model";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
} from "@/components/ai-elements/chain-of-thought";

const StructuredMessage = lazy(async () => {
  const m = await import("./structured-message");
  return { default: m.StructuredMessage };
});

const OpenUiMessage = lazy(async () => {
  const m = await import("./openui-message");
  return { default: m.OpenUiMessage };
});

const CompatWidgetMessage = lazy(async () => {
  const m = await import("./compat-widget-message");
  return { default: m.CompatWidgetMessage };
});

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

export interface CompatSandboxMessageViewProps {
  messageId?: number;
  role: "user" | "assistant" | "system" | "tool";
  name?: string;
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  swipeId?: number;
  swipes?: string[];
  openUiEnabled?: boolean;
  onOpenUiAction?: (event: ActionEvent) => void;
  structuredContent?: PartialStructuredResponse | null;
  onStructuredAction?: (label: string, value: string) => void;
  onStructuredCommandAction?: (command: string) => void;
  onWidgetSlashCommand?: (command: string) => Promise<void> | void;
}

/**
 * Chat message body for the compat iframe only: same compat pipeline as MessageBubble
 * but no action chrome, and heavy branches (structured / OpenUI / widgets) are lazy-loaded
 * so the sandbox entry bundle stays small and runtime starts faster.
 */
export function CompatSandboxMessageView({
  messageId,
  role,
  name,
  content,
  reasoning,
  isStreaming,
  swipeId = 0,
  swipes = [],
  openUiEnabled,
  onOpenUiAction,
  structuredContent,
  onStructuredAction,
  onStructuredCommandAction,
  onWidgetSlashCommand,
}: CompatSandboxMessageViewProps) {
  const { t } = useTranslation();
  const { formatAssistantForDisplay, preprocess } = useContentPreprocessor();
  const isUser = role === "user";

  const { display, scripts, segments, compatData, reasoningDisplay, hasWidgets } =
    prepareMessageViewModel({
      role,
      content,
      reasoning,
      formatAssistantForDisplay,
      preprocess,
    });

  const hasStructured = Boolean(structuredContent && structuredContent.blocks?.length);

  useMessageScriptRuntime({
    messageId,
    swipeId,
    scripts,
    swipesLength: swipes.length,
    enabled: Boolean(
      !isStreaming && messageId && role === "assistant" && scripts.length > 0 && !hasStructured,
    ),
  });

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-relaxed text-secondary-foreground">
          <CompatMarkdown content={content} className={markdownStyles} />
        </div>
      </div>
    );
  }

  return (
    <div className="group/message">
      {name && <p className="mb-1 text-xs font-medium text-muted-foreground">{name}</p>}

      {reasoningDisplay && (
        <ChainOfThought className="mb-2">
          <ChainOfThoughtHeader>{t("chat.reasoning")}</ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <CompatMarkdown
              content={reasoningDisplay}
              className={`${markdownStyles} whitespace-pre-wrap break-words text-muted-foreground`}
            />
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}

      <div className="text-sm leading-relaxed">
        <Suspense fallback={<DotsLoader size="sm" className="text-muted-foreground" />}>
          {hasStructured ? (
            <StructuredMessage
              data={structuredContent!}
              isStreaming={isStreaming}
              onAction={onStructuredAction}
              onCommandAction={onStructuredCommandAction}
            />
          ) : isStreaming && !content && !structuredContent ? (
            <DotsLoader size="md" className="text-muted-foreground" />
          ) : !isStreaming && hasWidgets ? (
            <CompatWidgetMessage
              messageId={messageId}
              swipeId={swipeId}
              segments={segments}
              compatData={compatData}
              markdownClassName={markdownStyles}
              onWidgetSlashCommand={onWidgetSlashCommand}
            />
          ) : openUiEnabled && isOpenUiLang(display) ? (
            <OpenUiMessage content={display} isStreaming={isStreaming} onAction={onOpenUiAction} />
          ) : isStreaming ? (
            <div className="whitespace-pre-wrap break-words">{display}</div>
          ) : (
            <CompatMarkdown content={display} className={markdownStyles} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
