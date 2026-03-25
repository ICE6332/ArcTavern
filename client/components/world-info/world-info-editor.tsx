"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { useWorldInfoStore } from "@/stores/world-info-store";

interface WorldInfoEditorProps {
  onClose: () => void;
}

export function WorldInfoEditor({ onClose }: WorldInfoEditorProps) {
  const { t } = useTranslation();
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
      void useWorldInfoStore.getState().selectBook(created.id);
    }
    onClose();
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label>{t("worldInfo.bookName")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("worldInfo.bookNamePlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label>{t("character.description")}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            void handleSave();
          }}
        >
          {book ? t("actions.update") : t("actions.create")}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
