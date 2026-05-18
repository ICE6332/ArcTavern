"use client";

import { useState } from "react";
import type { Character } from "@/lib/api/character";
import { characterApi } from "@/lib/api/character";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { CharacterEditorDialog } from "./character-editor-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon } from "@hugeicons/core-free-icons";

interface CharacterEditorLauncherProps {
  character: Character | null;
}

export function CharacterEditorLauncher({ character }: CharacterEditorLauncherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!character) {
    return <p className="px-1 text-xs text-muted-foreground">{t("character.selectToEdit")}</p>;
  }

  const descPreview = character.description?.trim() ?? "";

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
            {character.avatar ? (
              <img
                src={characterApi.avatarUrl(character.id)}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : (
              character.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{character.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {descPreview
                ? descPreview.slice(0, 48) + (descPreview.length > 48 ? "…" : "")
                : t("character.noDescription")}
            </p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <HugeiconsIcon icon={Edit02Icon} size={14} strokeWidth={1.5} />
          {t("character.editCharacter")}
        </Button>
      </div>

      <CharacterEditorDialog character={character} open={open} onOpenChange={setOpen} />
    </>
  );
}
