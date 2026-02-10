"use client";

import type { Character } from "@/lib/api";
import { Card } from "@/components/ui/card";

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  onClick: () => void;
}

export function CharacterCard({ character, isSelected, onClick }: CharacterCardProps) {
  return (
    <Card
      className={`cursor-pointer p-2.5 transition-colors ${
        isSelected
          ? "border-primary bg-accent"
          : "border-transparent hover:bg-accent/50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {character.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{character.name}</p>
          {character.creator && (
            <p className="truncate text-xs text-muted-foreground">
              by {character.creator}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
