"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { StreamingText } from "./streaming-text";
import { OpenUiMessage } from "./openui-message";
import { StructuredMessage } from "./structured-message";
import { CompatWidgetMessage } from "./compat-widget-message";
import { isOpenUiLang } from "@/lib/openui";
import { type PartialStructuredResponse } from "@/lib/openui/structured-types";
import type { ActionEvent } from "@openuidev/react-lang";
import { DotsLoader } from "@/components/ui/loader";
import { useContentPreprocessor } from "@/hooks/use-content-preprocessor";
import { useMessageScriptRuntime } from "@/hooks/use-message-script-runtime";
import { CompatMarkdown } from "@/lib/compat/markdown-pipeline";
import { prepareMessageViewModel } from "@/lib/compat/message-view-model";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
} from "@/components/ai-elements/chain-of-thought";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  RefreshIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  Delete01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

interface MessageBubbleProps {
  messageId?: number;
  role: "user" | "assistant" | "system" | "tool";
  name?: string;
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  swipeId?: number;
  swipes?: string[];
  onSwipe?: (messageId: number, direction: "left" | "right") => void;
  onRegenerate?: () => void;
  onDelete?: (messageId: number) => void;
  openUiEnabled?: boolean;
  onOpenUiAction?: (event: ActionEvent) => void;
  structuredContent?: PartialStructuredResponse | null;
  onStructuredAction?: (label: string, value: string) => void;
  onStructuredCommandAction?: (command: string) => void;
  onWidgetSlashCommand?: (command: string) => Promise<void> | void;
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "ghost",
}: {
  icon: typeof Copy01Icon;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={`h-7 w-7 text-muted-foreground ${
              variant === "destructive" ? "hover:text-destructive" : "hover:text-foreground"
            }`}
            onClick={onClick}
          />
        }
      >
        <HugeiconsIcon icon={icon} size={15} strokeWidth={1.5} />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function MessageBubble({
  messageId,
  role,
  name,
  content,
  reasoning,
  isStreaming,
  swipeId = 0,
  swipes = [],
  onSwipe,
  onRegenerate,
  onDelete,
  openUiEnabled,
  onOpenUiAction,
  structuredContent,
  onStructuredAction,
  onStructuredCommandAction,
  onWidgetSlashCommand,
}: MessageBubbleProps) {
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

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
  };

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
          <StreamingText content={display} isStreaming />
        ) : (
          <CompatMarkdown content={display} className={markdownStyles} />
        )}
      </div>

      {!isStreaming && (
        <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100 has-[:focus-visible]:opacity-100">
          <ActionButton icon={Copy01Icon} label={t("actions.copy")} onClick={handleCopy} />

          {onRegenerate && (
            <ActionButton
              icon={RefreshIcon}
              label={t("actions.regenerate")}
              onClick={onRegenerate}
            />
          )}

          <ActionButton icon={ThumbsUpIcon} label={t("chat.feedbackGood")} onClick={() => {}} />
          <ActionButton icon={ThumbsDownIcon} label={t("chat.feedbackBad")} onClick={() => {}} />

          {messageId && swipes.length > 1 && onSwipe && (
            <div className="ml-1 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onSwipe(messageId, "left")}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={1.5} />
              </Button>
              <span className="min-w-8 text-center text-xs tabular-nums text-muted-foreground">
                {swipeId + 1}/{swipes.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onSwipe(messageId, "right")}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={1.5} />
              </Button>
            </div>
          )}

          {messageId && onDelete && (
            <ActionButton
              icon={Delete01Icon}
              label={t("actions.delete")}
              onClick={() => onDelete(messageId)}
              variant="destructive"
            />
          )}
        </div>
      )}
    </div>
  );
}
