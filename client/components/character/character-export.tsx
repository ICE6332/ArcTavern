"use client";

import { Button } from "@/components/ui/button";
import { useCharacterStore } from "@/stores/character-store";

interface CharacterExportProps {
  characterId: number;
}

export function CharacterExport({ characterId }: CharacterExportProps) {
  const exportCharacter = useCharacterStore((s) => s.exportCharacter);

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => exportCharacter(characterId, "json")}
      >
        Export JSON
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => exportCharacter(characterId, "png")}
      >
        Export PNG
      </Button>
    </div>
  );
}
