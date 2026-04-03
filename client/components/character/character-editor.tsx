"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character } from "@/lib/api/character";
import { useTranslation } from "@/lib/i18n";
import { useCharacterStore } from "@/stores/character-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RuntimeAdapter, RuntimeManifest, RuntimeMode } from "@/lib/compat/runtime-manifest";

type Tab = "basic" | "advanced" | "book";

interface CharacterEditorProps {
  character: Character | null;
}

export function CharacterEditor({ character }: CharacterEditorProps) {
  const { t } = useTranslation();
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
    return <div className="text-xs text-muted-foreground">{t("character.selectToEdit")}</div>;
  }

  const patch = (value: Partial<Character>) => setForm((prev) => ({ ...prev, ...value }));
  const patchRuntimeManifest = (value: Partial<RuntimeManifest>) =>
    setForm((prev) => {
      const extensions = prev.extensions ?? {};
      const runtimeManifest = (extensions.runtimeManifest ?? {
        runtimeMode: "native" as RuntimeMode,
        promptCompat: false,
        renderCompat: false,
        capabilities: {
          regex: false,
          htmlDocument: false,
          script: false,
          xmlTags: false,
          variableInsert: false,
          eraData: false,
          placeholder: false,
          styledHtml: false,
          cssAnimation: false,
          externalAsset: false,
          lorebookRegex: false,
        },
        detectedFeatures: [],
      }) as RuntimeManifest;

      return {
        ...prev,
        extensions: {
          ...extensions,
          runtimeManifest: {
            ...runtimeManifest,
            ...value,
          },
        },
      };
    });

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
          {t("character.tabBasic")}
        </Button>
        <Button
          variant={tab === "advanced" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setTab("advanced")}
        >
          {t("character.tabAdvanced")}
        </Button>
        <Button
          variant={tab === "book" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setTab("book")}
        >
          {t("character.tabBook")}
        </Button>
      </div>

      {tab === "basic" && (
        <div className="flex flex-col gap-1.5">
          <Input
            value={form.name ?? ""}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={t("character.name")}
            className="h-8 text-xs"
          />
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder={t("character.description")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.personality ?? ""}
            onChange={(e) => patch({ personality: e.target.value })}
            placeholder={t("character.personality")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.scenario ?? ""}
            onChange={(e) => patch({ scenario: e.target.value })}
            placeholder={t("character.scenario")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.firstMes ?? ""}
            onChange={(e) => patch({ firstMes: e.target.value })}
            placeholder={t("character.firstMessage")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.mesExample ?? ""}
            onChange={(e) => patch({ mesExample: e.target.value })}
            placeholder={t("character.messageExamples")}
            className="min-h-[56px] text-xs"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("character.avatar")}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handleAvatar(e);
              }}
              className="text-xs"
            />
          </label>
        </div>
      )}

      {tab === "advanced" && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Runtime Mode
              <select
                value={
                  ((form.extensions?.runtimeManifest as RuntimeManifest | undefined)?.runtimeMode ??
                    "native") as RuntimeMode
                }
                onChange={(e) =>
                  patchRuntimeManifest({ runtimeMode: e.target.value as RuntimeMode })
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="native">native</option>
                <option value="compat-sandbox">compat-sandbox</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Runtime Adapter
              <select
                value={
                  ((form.extensions?.runtimeManifest as RuntimeManifest | undefined)?.adapter ??
                    "st-generic") as RuntimeAdapter
                }
                onChange={(e) =>
                  patchRuntimeManifest({ adapter: e.target.value as RuntimeAdapter })
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="st-generic">st-generic</option>
                <option value="era">era</option>
                <option value="fate">fate</option>
                <option value="custom">custom</option>
              </select>
            </label>
          </div>
          {(form.extensions?.runtimeManifest as RuntimeManifest | undefined)?.detectedFeatures
            ?.length ? (
            <div className="rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
              {(
                form.extensions?.runtimeManifest as RuntimeManifest | undefined
              )?.detectedFeatures.join(", ")}
            </div>
          ) : null}
          <Textarea
            value={form.systemPrompt ?? ""}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            placeholder={t("character.systemPrompt")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={form.postHistoryInstructions ?? ""}
            onChange={(e) => patch({ postHistoryInstructions: e.target.value })}
            placeholder={t("character.postHistoryInstructions")}
            className="min-h-[56px] text-xs"
          />
          <Textarea
            value={greetingsText}
            onChange={(e) => patch({ alternateGreetings: e.target.value.split("\n") })}
            placeholder={t("character.alternateGreetings")}
            className="min-h-[56px] text-xs"
          />
          <Input
            value={form.creator ?? ""}
            onChange={(e) => patch({ creator: e.target.value })}
            placeholder={t("character.creator")}
            className="h-8 text-xs"
          />
          <Input
            value={form.creatorNotes ?? ""}
            onChange={(e) => patch({ creatorNotes: e.target.value })}
            placeholder={t("character.creatorNotes")}
            className="h-8 text-xs"
          />
          <Input
            value={form.characterVersion ?? ""}
            onChange={(e) => patch({ characterVersion: e.target.value })}
            placeholder={t("character.characterVersion")}
            className="h-8 text-xs"
          />
          <Input
            value={tagsText}
            onChange={(e) => patch({ tags: e.target.value.split(",") })}
            placeholder={t("character.tags")}
            className="h-8 text-xs"
          />
        </div>
      )}

      {tab === "book" && (
        <Textarea
          value={bookJson}
          onChange={(e) => setBookJson(e.target.value)}
          placeholder={t("character.characterBook")}
          className="min-h-[180px] font-mono text-xs"
        />
      )}

      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
        >
          {saving ? t("messages.saving") : t("actions.save")}
        </Button>
      </div>
    </div>
  );
}
