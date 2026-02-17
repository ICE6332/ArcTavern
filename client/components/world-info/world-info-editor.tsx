"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorldInfoStore } from "@/stores/world-info-store";

interface WorldInfoEditorProps {
  onClose: () => void;
}

export function WorldInfoEditor({ onClose }: WorldInfoEditorProps) {
  const { books, selectedBookId, createBook, updateBook } = useWorldInfoStore();
  const book = selectedBookId ? books.find((b) => b.id === selectedBookId) : null;

  const [name, setName] = useState(book?.name ?? "");
  const [description, setDescription] = useState(book?.description ?? "");

  const handleSave = async () => {
    if (!name.trim()) return;
    if (book) {
      await updateBook(book.id, { name, description });
    } else {
      const created = await createBook({ name, description });
      // Auto-select the new book
      useWorldInfoStore.getState().selectBook(created.id);
    }
    onClose();
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label>Book Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lorebook name" />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>{book ? "Update" : "Create"}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
