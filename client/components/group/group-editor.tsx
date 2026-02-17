"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGroupStore } from "@/stores/group-store";
import { useCharacterStore } from "@/stores/character-store";
import type { Group } from "@/lib/api";

interface GroupEditorProps {
  group?: Group | null;
  onClose: () => void;
}

export function GroupEditor({ group, onClose }: GroupEditorProps) {
  const { createGroup, updateGroup, members, addMember, removeMember } = useGroupStore();
  const { characters } = useCharacterStore();

  const [name, setName] = useState(group?.name ?? "");
  const [strategy, setStrategy] = useState(String(group?.activationStrategy ?? 0));

  const handleSave = async () => {
    if (!name.trim()) return;
    if (group) {
      await updateGroup(group.id, { name, activationStrategy: Number(strategy) });
    } else {
      await createGroup({ name, activationStrategy: Number(strategy) });
    }
    onClose();
  };

  const memberCharIds = new Set(members.map((m) => m.characterId));
  const availableChars = characters.filter((c) => !memberCharIds.has(c.id));

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label>Group Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
      </div>
      <div className="space-y-1">
        <Label>Turn Strategy</Label>
        <Select value={strategy} onValueChange={(value) => setStrategy(value ?? "0")}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Natural</SelectItem>
            <SelectItem value="1">List (Round-robin)</SelectItem>
            <SelectItem value="2">Manual</SelectItem>
            <SelectItem value="3">Random Pool</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {group && (
        <div className="space-y-2">
          <Label>Members</Label>
          <div className="space-y-1">
            {members.map((m) => {
              const char = characters.find((c) => c.id === m.characterId);
              return (
                <div key={m.characterId} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                  <span>{char?.name ?? `Character #${m.characterId}`}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember(group.id, m.characterId)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          {availableChars.length > 0 && (
            <Select onValueChange={(v) => addMember(group.id, Number(v))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add member..." /></SelectTrigger>
              <SelectContent>
                {availableChars.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>{group ? "Update" : "Create"}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
