"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { usePersonaStore } from "@/stores/persona-store";
import type { Persona } from "@/lib/api";

interface PersonaEditorProps {
  persona?: Persona | null;
  onClose: () => void;
}

export function PersonaEditor({ persona, onClose }: PersonaEditorProps) {
  const { t } = useTranslation();
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
        <Label>{t("persona.name")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("persona.namePlaceholder")}
        />
      </div>
      <div className="space-y-1">
        <Label>{t("persona.description")}</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("persona.descriptionPlaceholder")}
          rows={4}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        {t("persona.setDefault")}
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            void handleSave();
          }}
        >
          {persona ? t("actions.update") : t("actions.create")}
        </Button>
        {persona && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
          >
            {t("actions.delete")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
