"use client";

import { Button } from "@/components/ui/button";
import { useCharacterStore } from "@/stores/character-store";
import { toast } from "@/lib/toast";

interface CharacterExportProps {
  characterId: number;
}

export function CharacterExport({ characterId }: CharacterExportProps) {
  const exportCharacter = useCharacterStore((s) => s.exportCharacter);

  const handleExport = async (format: "json" | "png") => {
    try {
      await exportCharacter(characterId, format);
      toast.success({ title: `Exported as ${format.toUpperCase()}` });
    } catch (err) {
      toast.error({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => void handleExport("json")}
      >
        Export JSON
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => void handleExport("png")}
      >
        Export PNG
      </Button>
    </div>
  );
}
