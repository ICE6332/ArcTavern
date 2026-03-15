"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/api";
import { useCharacterStore } from "@/stores/character-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Tab = "basic" | "advanced" | "book";

interface CharacterEditorProps {
  character: Character | null;
}

export function CharacterEditor({ character }: CharacterEditorProps) {
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const updateAvatar = useCharacterStore((s) => s.updateAvatar);
  const [tab, setTab] = useState<Tab>("basic");
  const [saving, setSaving] = useState(false);
  const [bookJson, setBookJson] = useState("");
  const [form, setForm] = useState<Partial<Character>>({});

  useEffect(() => {
    if (!character) {
      setForm({});
      setBookJson("");
      return;
    }
    setForm(character);
    setBookJson(character.characterBook ? JSON.stringify(character.characterBook, null, 2) : "");
  }, [character]);

  const tagsText = useMemo(() => (form.tags ?? []).join(", "), [form.tags]);
  const greetingsText = useMemo(
    () => (form.alternateGreetings ?? []).join("\n"),
    [form.alternateGreetings],
  );

  if (!character) {
    return <div className="text-xs text-muted-foreground">Select a character to edit</div>;
  }

  const patch = (value: Partial<Character>) => setForm((prev) => ({ ...prev, ...value }));

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await updateAvatar(character.id, file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsedBook: Record<string, unknown> | null = null;
      if (bookJson.trim()) {
        parsedBook = JSON.parse(bookJson);
      }
      await updateCharacter(character.id, {
        ...form,
        tags: (tagsText || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        alternateGreetings: (greetingsText || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        characterBook: parsedBook,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex gap-1">
        <Button
          variant={tab === "basic" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setTab("basic")}
        >
          Basic
        </Button>
        <Button
          variant={tab === "advanced" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setTab("advanced")}
        >
          Advanced
        </Button>
        <Button
          variant={tab === "book" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setTab("book")}
        >
          Book
        </Button>
      </div>

      {tab === "basic" && (
        <div className="flex flex-col gap-1.5">
          <Input
            value={form.name ?? ""}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Name"
            className="h-8 text-xs"
          />
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Description"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.personality ?? ""}
            onChange={(e) => patch({ personality: e.target.value })}
            placeholder="Personality"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.scenario ?? ""}
            onChange={(e) => patch({ scenario: e.target.value })}
            placeholder="Scenario"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.firstMes ?? ""}
            onChange={(e) => patch({ firstMes: e.target.value })}
            placeholder="First message"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.mesExample ?? ""}
            onChange={(e) => patch({ mesExample: e.target.value })}
            placeholder="Message examples"
            className="min-h-[56px] text-xs"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Avatar
            <input type="file" accept="image/*" onChange={handleAvatar} className="text-xs" />
          </label>
        </div>
      )}

      {tab === "advanced" && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={form.systemPrompt ?? ""}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            placeholder="System prompt"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.postHistoryInstructions ?? ""}
            onChange={(e) => patch({ postHistoryInstructions: e.target.value })}
            placeholder="Post history instructions"
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={greetingsText}
            onChange={(e) => patch({ alternateGreetings: e.target.value.split("\n") })}
            placeholder="Alternate greetings (one per line)"
            className="min-h-[56px] text-xs"
          />
          <Input
            value={form.creator ?? ""}
            onChange={(e) => patch({ creator: e.target.value })}
            placeholder="Creator"
            className="h-8 text-xs"
          />
          <Input
            value={form.creatorNotes ?? ""}
            onChange={(e) => patch({ creatorNotes: e.target.value })}
            placeholder="Creator notes"
            className="h-8 text-xs"
          />
          <Input
            value={form.characterVersion ?? ""}
            onChange={(e) => patch({ characterVersion: e.target.value })}
            placeholder="Character version"
            className="h-8 text-xs"
          />
          <Input
            value={tagsText}
            onChange={(e) => patch({ tags: e.target.value.split(",") })}
            placeholder="Tags (comma separated)"
            className="h-8 text-xs"
          />
        </div>
      )}

      {tab === "book" && (
        <Textarea
          value={bookJson}
          onChange={(e) => setBookJson(e.target.value)}
          placeholder="Character book JSON"
          className="min-h-[180px] font-mono text-xs"
        />
      )}

      <div className="flex justify-end gap-1">
        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
