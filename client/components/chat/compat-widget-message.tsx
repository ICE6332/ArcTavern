"use client";

import { CompatMarkdown } from "@/lib/compat/markdown-pipeline";
import type { AssistantRenderSegment, CompatBridgeData } from "@/lib/compat/widget-pipeline";
import { CompatHtmlWidget } from "./compat-html-widget";

interface CompatWidgetMessageProps {
  messageId?: number;
  swipeId: number;
  segments: AssistantRenderSegment[];
  compatData: CompatBridgeData;
  markdownClassName?: string;
  onWidgetSlashCommand?: (command: string) => Promise<void> | void;
}

export function CompatWidgetMessage({
  messageId,
  swipeId,
  segments,
  compatData,
  markdownClassName,
  onWidgetSlashCommand,
}: CompatWidgetMessageProps) {
  return (
    <div className="space-y-4">
      {segments.map((segment, index) => {
        if (segment.type === "widget") {
          return (
            <CompatHtmlWidget
              key={`widget-${index}`}
              messageId={messageId}
              swipeId={swipeId}
              html={segment.html}
              compatData={compatData}
              onRunSlashCommand={onWidgetSlashCommand}
            />
          );
        }

        return (
          <CompatMarkdown
            key={`markdown-${index}`}
            content={segment.content}
            className={markdownClassName}
          />
        );
      })}
    </div>
  );
}
