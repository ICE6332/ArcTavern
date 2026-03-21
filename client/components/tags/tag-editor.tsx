"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTagStore } from "@/stores/tag-store";

interface TagEditorProps {
  editingTagId?: string | null;
  onClose: () => void;
}

export function TagEditor({ editingTagId, onClose }: TagEditorProps) {
  const { tags, createTag, updateTag, deleteTag } = useTagStore();
  const existing = editingTagId ? tags.find((t) => t.id === editingTagId) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? "#6366f1");
  const [color2, setColor2] = useState(existing?.color2 ?? "#ffffff");

  const handleSave = async () => {
    if (!name.trim()) return;
    if (existing) {
      await updateTag(existing.id, { name, color, color2 });
    } else {
      await createTag({ name, color, color2 });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (existing) {
      await deleteTag(existing.id);
      onClose();
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" />
      </div>
      <div className="flex gap-3">
        <div className="space-y-1">
          <Label>Color</Label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border"
          />
        </div>
        <div className="space-y-1">
          <Label>Text</Label>
          <input
            type="color"
            value={color2}
            onChange={(e) => setColor2(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            void handleSave();
          }}
        >
          {existing ? "Update" : "Create"}
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
          >
            Delete
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
