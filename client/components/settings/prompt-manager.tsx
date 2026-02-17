"use client";

import { useState } from "react";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { Button } from "@/components/ui/button";
import { PromptComponentItem } from "./prompt-component-item";
import { PromptComponentEditorCard } from "./prompt-component-editor-card";
import { useTranslation } from "@/lib/i18n";

export function PromptManager() {
  const { t } = useTranslation();
  const { components, moveComponent, resetToDefaults, addCustomComponent } = usePromptManagerStore();
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);

  const sorted = [...components].sort((a, b) => a.position - b.position);
  const editingComponent =
    sorted.find((component) => component.id === editingComponentId) ?? null;

  const handleMoveUp = (id: string) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx > 0) moveComponent(id, idx - 1);
  };

  const handleMoveDown = (id: string) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < sorted.length - 1) moveComponent(id, idx + 1);
  };

  if (editingComponent) {
    return (
      <PromptComponentEditorCard
        key={editingComponent.id}
        component={editingComponent}
        onBack={() => setEditingComponentId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("promptManager.title")}</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => addCustomComponent(t("promptManager.customPrompt"), "system", "")}
          >
            {t("promptManager.custom")}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetToDefaults}>
            {t("promptManager.reset")}
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        {sorted.map((component) => (
          <PromptComponentItem
            key={component.id}
            component={component}
            onMoveUp={() => handleMoveUp(component.id)}
            onMoveDown={() => handleMoveDown(component.id)}
            onEdit={() => setEditingComponentId(component.id)}
          />
        ))}
      </div>
    </div>
  );
}
