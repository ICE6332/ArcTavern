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
  const { members } = useGroupStore();
  const { characters } = useCharacterStore();

  const memberChars = members
    .map((m) => characters.find((c) => c.id === m.characterId))
    .filter(Boolean);

  return (
    <Select onValueChange={(v) => onSelect(Number(v))}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select speaker..." />
      </SelectTrigger>
      <SelectContent>
        {memberChars.map((char) => (
          <SelectItem key={char!.id} value={String(char!.id)}>
            {char!.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
