"use client";

import { usePromptManagerStore, type PromptComponent } from "@/stores/prompt-manager-store";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

const BUILT_IN_DEFAULT_NAMES: Record<string, string> = {
  main: "Main Prompt",
  worldInfoBefore: "World Info (Before)",
  charDescription: "Character Description",
  charPersonality: "Character Personality",
  scenario: "Scenario",
  enhanceDefinitions: "Enhance Definitions",
  nsfw: "NSFW Prompt",
  worldInfoAfter: "World Info (After)",
  personaDescription: "Persona Description",
  dialogueExamples: "Chat Examples",
  chatHistory: "Chat History",
  jailbreak: "Post-History Instructions",
};

interface PromptComponentItemProps {
  component: PromptComponent;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
}

export function PromptComponentItem({ component, onMoveUp, onMoveDown, onEdit }: PromptComponentItemProps) {
  const { toggleComponent, removeCustomComponent } = usePromptManagerStore();
  const { t } = useTranslation();

  const nameKey = `promptComponents.names.${component.id}`;
  const roleKey = `promptComponents.roles.${component.role}`;
  const defaultName = BUILT_IN_DEFAULT_NAMES[component.id];
  const shouldTranslateName =
    component.isBuiltIn &&
    !!defaultName &&
    component.name === defaultName;
  const translatedName =
    shouldTranslateName && t(nameKey) !== nameKey ? t(nameKey) : component.name;
  const translatedRole = t(roleKey) === roleKey ? component.role : t(roleKey);

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        component.enabled ? "border-border" : "border-border/50 opacity-50"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <button className="text-muted-foreground hover:text-foreground" onClick={onMoveUp}>
          ^
        </button>
        <button className="text-muted-foreground hover:text-foreground" onClick={onMoveDown}>
          v
        </button>
      </div>

      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        <input
          type="checkbox"
          checked={component.enabled}
          onChange={() => toggleComponent(component.id)}
          className="h-3 w-3"
        />
        <span className="truncate font-medium">{translatedName}</span>
        <span className="text-[10px] text-muted-foreground">({translatedRole})</span>
      </label>

      <Button
        size="sm"
        variant="ghost"
        className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={onEdit}
      >
        Edit
      </Button>

      {!component.isBuiltIn && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeCustomComponent(component.id)}
        >
          x
        </Button>
      )}
    </div>
  );
}
