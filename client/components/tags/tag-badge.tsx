"use client";

import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/lib/api";

interface TagBadgeProps {
  tag: Tag;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}

export function TagBadge({ tag, onClick, removable, onRemove }: TagBadgeProps) {
  const style = tag.color ? { backgroundColor: tag.color, color: tag.color2 ?? "#fff" } : undefined;

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer gap-1 text-xs"
      style={style}
      onClick={onClick}
    >
      {tag.name}
      {removable && (
        <button
          className="ml-1 hover:opacity-70"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        >
          ×
        </button>
      )}
    </Badge>
  );
}
