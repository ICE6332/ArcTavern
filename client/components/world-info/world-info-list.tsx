"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWorldInfoStore } from "@/stores/world-info-store";

interface WorldInfoListProps {
  onSelectBook: (id: number) => void;
  onCreateBook: () => void;
}

export function WorldInfoList({ onSelectBook, onCreateBook }: WorldInfoListProps) {
  const { books, selectedBookId, fetchBooks, deleteBook } = useWorldInfoStore();

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Lorebooks</h3>
        <Button size="sm" variant="outline" onClick={onCreateBook}>
          + New
        </Button>
      </div>
      <div className="space-y-1">
        {books.map((book) => (
          <div
            key={book.id}
            className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
              selectedBookId === book.id ? "bg-accent" : ""
            }`}
            onClick={() => onSelectBook(book.id)}
          >
            <span className="truncate">{book.name}</span>
            <button
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                void deleteBook(book.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {books.length === 0 && <p className="text-xs text-muted-foreground">No lorebooks yet</p>}
      </div>
    </div>
  );
}
