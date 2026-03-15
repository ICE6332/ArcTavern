"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePersonaStore } from "@/stores/persona-store";
import type { Persona } from "@/lib/api";

interface PersonaEditorProps {
  persona?: Persona | null;
  onClose: () => void;
}

export function PersonaEditor({ persona, onClose }: PersonaEditorProps) {
  const { createPersona, updatePersona, deletePersona } = usePersonaStore();

  const [name, setName] = useState(persona?.name ?? "");
  const [description, setDescription] = useState(persona?.description ?? "");
  const [isDefault, setIsDefault] = useState(persona?.isDefault ?? false);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (persona) {
      await updatePersona(persona.id, { name, description, isDefault });
    } else {
      await createPersona({ name, description, isDefault });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (persona) {
      await deletePersona(persona.id);
      onClose();
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Persona name" />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this persona..."
          rows={4}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Set as default persona
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          {persona ? "Update" : "Create"}
        </Button>
        {persona && (
          <Button size="sm" variant="destructive" onClick={handleDelete}>
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
