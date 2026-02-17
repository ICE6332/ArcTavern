"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onStop: () => Promise<void>;
  onContinue: () => Promise<void>;
  onImpersonate: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  isGenerating?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  onContinue,
  onImpersonate,
  onRegenerate,
  isGenerating,
  disabled,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isGenerating) return;
    await onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }, [value, disabled, isGenerating, onSend]);

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            disabled={disabled}
            className="min-h-[44px] max-h-[240px] resize-none"
            rows={1}
          />
          {isGenerating ? (
            <Button onClick={onStop} className="shrink-0 self-end" size="sm" variant="destructive">
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              className="shrink-0 self-end"
              size="sm"
            >
              Send
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onContinue}
            disabled={Boolean(isGenerating)}
          >
            Continue
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onImpersonate}
            disabled={Boolean(isGenerating)}
          >
            Impersonate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onRegenerate}
            disabled={Boolean(isGenerating)}
          >
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
