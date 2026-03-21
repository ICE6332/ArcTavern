"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";

interface ChatInputProps {
  onSend: (content: string) => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onContinue: () => void | Promise<void>;
  onImpersonate: () => void | Promise<void>;
  canContinue?: boolean;
  canImpersonate?: boolean;
  isGenerating?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  onContinue,
  onImpersonate,
  canContinue = true,
  canImpersonate = true,
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

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isGenerating) return;
    await onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }, [value, disabled, isGenerating, onSend]);

  const handleSend = () => {
    void submit();
  };

  const handleStop = () => {
    void onStop();
  };

  const handleContinue = () => {
    void onContinue();
  };

  const handleImpersonate = () => {
    void onImpersonate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !disabled && !isGenerating && value.trim().length > 0;

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            style={{ minHeight: "44px", maxHeight: "240px" }}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleContinue}
                disabled={Boolean(isGenerating) || !canContinue}
              >
                Continue
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleImpersonate}
                disabled={Boolean(isGenerating) || !canImpersonate}
              >
                Impersonate
              </Button>
            </div>

            <div>
              {isGenerating ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={handleStop}
                        size="icon-sm"
                        variant="destructive"
                        className="h-8 w-8 rounded-full"
                      />
                    }
                  >
                    <HugeiconsIcon icon={StopIcon} size={16} strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Stop</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={handleSend}
                        disabled={!canSend}
                        size="icon-sm"
                        className="h-8 w-8 rounded-full"
                      />
                    }
                  >
                    <HugeiconsIcon icon={ArrowUp02Icon} size={16} strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Send</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
