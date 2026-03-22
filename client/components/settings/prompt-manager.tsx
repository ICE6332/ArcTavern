"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { usePromptManagerStore } from "@/stores/prompt-manager-store";
import { Button } from "@/components/ui/button";
import { PromptComponentItem } from "./prompt-component-item";
import { PromptComponentEditorCard } from "./prompt-component-editor-card";
import { useTranslation } from "@/lib/i18n";

export function PromptManager() {
  const { t } = useTranslation();
  const { components, moveComponent, resetToDefaults, addCustomComponent } =
    usePromptManagerStore();
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);

  const sorted = [...components].sort((a, b) => a.position - b.position);
  const editingComponent = sorted.find((component) => component.id === editingComponentId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const newIndex = sorted.findIndex((c) => c.id === over.id);
      if (newIndex !== -1) moveComponent(active.id as string, newIndex);
    },
    [sorted, moveComponent],
  );

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {sorted.map((component) => (
              <PromptComponentItem
                key={component.id}
                component={component}
                onEdit={() => setEditingComponentId(component.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
