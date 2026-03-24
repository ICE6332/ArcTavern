"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useQuickReplyStore } from "@/stores/quick-reply-store";

interface QuickReplyBarProps {
  onExecute: (script: string) => void;
}

export function QuickReplyBar({ onExecute }: QuickReplyBarProps) {
  const { loaded, loadSets, getVisibleQrs } = useQuickReplyStore();

  useEffect(() => {
    if (!loaded) void loadSets();
  }, [loaded, loadSets]);

  const visibleQrs = getVisibleQrs();

  if (visibleQrs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pt-2">
      {visibleQrs.map(({ qr, set }) => (
        <Button
          key={`${set.name}-${qr.id}`}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          style={set.color ? { borderColor: set.color, color: set.color } : undefined}
          title={qr.title ?? qr.message}
          onClick={() => onExecute(qr.message)}
        >
          {qr.label}
        </Button>
      ))}
    </div>
  );
}
