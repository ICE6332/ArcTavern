"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { registry } from "@/lib/slash-commands/registry";

interface SlashAutocompleteProps {
  partial: string;
  onSelect: (commandName: string) => void;
  onClose: () => void;
}

export function SlashAutocomplete({
  partial,
  onSelect,
  onClose,
}: SlashAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => registry.getCompletions(partial).slice(0, 10),
    [partial],
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].name);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (results.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
    >
      {results.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors ${
            i === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.name);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="font-mono text-xs font-medium text-primary">
            /{cmd.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {cmd.helpString}
          </span>
        </button>
      ))}
    </div>
  );
}
