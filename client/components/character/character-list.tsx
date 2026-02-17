"use client";

import { useMemo, useState } from "react";
import type { Character } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "./character-card";
import { useTranslation } from "@/lib/i18n";

type ViewMode = "list" | "grid";
type SortMode = "updated" | "name" | "created";

interface CharacterListProps {
  characters: Character[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onDelete?: (id: number) => void;
  onExport?: (id: number) => void;
}

export function CharacterList({
  characters,
  selectedId,
  onSelect,
  onDuplicate,
  onDelete,
  onExport,
}: CharacterListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = characters.filter((c) => c.name.toLowerCase().includes(q));
    return list.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [characters, search, sortMode]);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("character.searchPlaceholder")}
        className="h-8 text-xs"
      />

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="updated">{t("character.sortRecent")}</option>
          <option value="created">{t("character.sortCreated")}</option>
          <option value="name">{t("character.sortName")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{t("character.noCharacters")}</div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-2 gap-1"
              : "flex flex-col gap-1"
          }
        >
          {filtered.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              isSelected={character.id === selectedId}
              isFavorite={Boolean(favorites[character.id])}
              compact={viewMode === "grid"}
              onClick={() => onSelect(character.id)}
              onToggleFavorite={() => toggleFavorite(character.id)}
              onDuplicate={onDuplicate ? () => onDuplicate(character.id) : undefined}
              onDelete={onDelete ? () => onDelete(character.id) : undefined}
              onExport={onExport ? () => onExport(character.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
