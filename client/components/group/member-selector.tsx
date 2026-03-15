"use client";

import { useCharacterStore } from "@/stores/character-store";
import { useGroupStore } from "@/stores/group-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberSelectorProps {
  groupId: string;
  onSelect: (characterId: number) => void;
}

export function MemberSelector({ groupId, onSelect }: MemberSelectorProps) {
  const { groups, members } = useGroupStore();
  const { characters } = useCharacterStore();
  const group = groups.find((item) => item.id === groupId);

  const memberChars = members
    .map((m) => characters.find((c) => c.id === m.characterId))
    .filter(Boolean);

  return (
    <Select onValueChange={(v) => onSelect(Number(v))}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select speaker..." />
      </SelectTrigger>
      <SelectContent>
        {group?.name ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{group.name}</div>
        ) : null}
        {memberChars.map((char) => (
          <SelectItem key={char!.id} value={String(char!.id)}>
            {char!.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
