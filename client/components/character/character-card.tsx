"use client";

import { useEffect, useState } from "react";
import type { Character, Tag } from "@/lib/api";
import { tagApi } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { characterApi } from "@/lib/api";
import { TagBadge } from "@/components/tags/tag-badge";

interface CharacterCardProps {
  character: Character;
  isSelected: boolean;
  isFavorite?: boolean;
  compact?: boolean;
  onClick: () => void;
  onToggleFavorite?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

export function CharacterCard({
  character,
  isSelected,
  isFavorite,
  compact,
  onClick,
  onToggleFavorite,
  onDuplicate,
  onExport,
  onDelete,
}: CharacterCardProps) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    tagApi.getEntityTags("character", String(character.id)).then(setTags).catch(() => {});
  }, [character.id]);

  return (
    <Card
      className={`cursor-pointer p-2 transition-colors ${
        isSelected ? "border-primary bg-accent" : "border-transparent hover:bg-accent/50"
      }`}
      onClick={onClick}
    >
      <div className={`flex ${compact ? "flex-col gap-1" : "items-center gap-2"}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary">
          {character.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={characterApi.avatarUrl(character.id)} alt={character.name} className="h-full w-full object-cover" />
          ) : (
            character.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-medium">{character.name}</p>
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className={`text-xs ${isFavorite ? "text-yellow-500" : "text-muted-foreground"}`}
                title={t("character.toggleFavorite")}
              >
                *
              </button>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {character.creator ? `by ${character.creator}` : t("character.noCreator")} ·{" "}
            {character.updatedAt ? new Date(character.updatedAt).toLocaleDateString() : t("character.notApplicable")}
          </p>
          {tags.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>
      </div>

      {(onDuplicate || onExport || onDelete) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {onDuplicate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              Duplicate
            </Button>
          )}
          {onExport && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
            >
              Export
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
