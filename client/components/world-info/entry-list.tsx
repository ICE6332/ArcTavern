"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorldInfoStore } from "@/stores/world-info-store";
import type { WorldInfoEntry } from "@/lib/api";

interface EntryListProps {
  onEditEntry: (entry: WorldInfoEntry) => void;
}

export function EntryList({ onEditEntry }: EntryListProps) {
  const { entries, selectedBookId, createEntry, deleteEntry } = useWorldInfoStore();
  const [search, setSearch] = useState("");

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.keys.some((k) => k.toLowerCase().includes(q)) ||
      e.comment.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q)
    );
  });

  const handleAddEntry = async () => {
    if (!selectedBookId) return;
    await createEntry(selectedBookId, { keys: ["new keyword"], content: "", comment: "New entry" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={handleAddEntry}>
          + Entry
        </Button>
      </div>
      <div className="max-h-[400px] space-y-1 overflow-y-auto">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="flex cursor-pointer items-center justify-between rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
            onClick={() => onEditEntry(entry)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${entry.enabled ? "bg-green-500" : "bg-gray-400"}`}
                />
                <span className="truncate font-medium">
                  {entry.comment || entry.keys.join(", ") || "Untitled"}
                </span>
                {entry.constant && <span className="text-[10px] text-blue-400">const</span>}
              </div>
              <div className="truncate text-muted-foreground">Keys: {entry.keys.join(", ")}</div>
            </div>
            <button
              className="ml-2 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteEntry(entry.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {entries.length === 0 ? "No entries yet" : "No matches"}
          </p>
        )}
      </div>
    </div>
  );
}
