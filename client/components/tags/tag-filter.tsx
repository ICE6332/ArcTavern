"use client";

import { useTagStore } from "@/stores/tag-store";
import { TagBadge } from "./tag-badge";

export function TagFilter() {
  const { tags, filterState, toggleFilter, clearFilters } = useTagStore();

  if (tags.length === 0) return null;

  const hasActiveFilters = Object.values(filterState).some((v) => v !== null);

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1">
      {hasActiveFilters && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={clearFilters}
        >
          Clear
        </button>
      )}
      {tags
        .filter((t) => !t.isHidden)
        .map((tag) => {
          const state = filterState[tag.id] ?? null;
          return (
            <div
              key={tag.id}
              className={`rounded-sm transition-opacity ${
                state === "include"
                  ? "ring-2 ring-primary"
                  : state === "exclude"
                    ? "opacity-40 line-through"
                    : ""
              }`}
            >
              <TagBadge tag={tag} onClick={() => toggleFilter(tag.id)} />
            </div>
          );
        })}
    </div>
  );
}
