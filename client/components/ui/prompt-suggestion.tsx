"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PromptSuggestionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export function PromptSuggestion({ children, className, ...props }: PromptSuggestionProps) {
  return (
    <Button
      variant="outline"
      size="lg"
      className={cn(
        "rounded-full border-border/60 bg-card/50 px-5 text-sm font-normal text-foreground/80 shadow-none transition-all hover:border-border hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
