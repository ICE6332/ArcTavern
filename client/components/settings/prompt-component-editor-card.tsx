"use client";

import { useState } from "react";
import { usePromptManagerStore, type PromptComponent } from "@/stores/prompt-manager-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PromptComponentEditorCardProps {
  component: PromptComponent;
  onBack: () => void;
}

interface PromptDraft {
  name: string;
  role: PromptComponent["role"];
  content: string;
  enabled: boolean;
}

export function PromptComponentEditorCard({
  component,
  onBack,
}: PromptComponentEditorCardProps) {
  const { updateComponent, removeCustomComponent } = usePromptManagerStore();
  const [draft, setDraft] = useState<PromptDraft>({
    name: component.name,
    role: component.role,
    content: component.content ?? "",
    enabled: component.enabled,
  });

  const isMarker = component.isMarker;

  const handleSave = () => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return;

    updateComponent(component.id, {
      name: trimmedName,
      role: draft.role,
      enabled: draft.enabled,
      ...(isMarker ? {} : { content: draft.content }),
    });
    onBack();
  };

  const handleDelete = () => {
    if (component.isBuiltIn) return;
    const confirmed = window.confirm(`Delete prompt "${component.name}"?`);
    if (!confirmed) return;
    removeCustomComponent(component.id);
    onBack();
  };

  return (
    <Card size="sm" className="border-border/70">
      <CardHeader className="border-b border-border/70">
        <CardTitle className="text-xs">Prompt Editor</CardTitle>
        <CardDescription className="text-[11px]">
          Edit this prompt block and save it back to the current preset layout.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Identifier</Label>
          <div className="rounded-md border border-border/70 bg-input/20 px-2 py-1 text-[11px] text-muted-foreground">
            {component.id}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Prompt name"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Role</Label>
          <Select
            value={draft.role}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                role: (value as PromptComponent["role"]) ?? prev.role,
              }))
            }
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">system</SelectItem>
              <SelectItem value="user">user</SelectItem>
              <SelectItem value="assistant">assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-3.5 w-3.5"
          />
          Enabled in prompt order
        </label>

        <div className="space-y-1">
          <Label className="text-[11px]">Content</Label>
          {isMarker ? (
            <div className="rounded-md border border-border/70 bg-input/20 px-2 py-2 text-[11px] text-muted-foreground">
              Marker prompt blocks are placeholders and do not store editable content.
            </div>
          ) : (
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Prompt content"
              className="min-h-24 text-[11px]"
            />
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/70 justify-between gap-2">
        <div>
          {!component.isBuiltIn && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] text-destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onBack}>
            Back
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={handleSave}
            disabled={!draft.name.trim()}
          >
            Save
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
