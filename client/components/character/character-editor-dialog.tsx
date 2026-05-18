"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { characterApi, type Character } from "@/lib/api/character";
import { useTranslation } from "@/lib/i18n";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CompatMarkdown } from "@/lib/compat/markdown-pipeline";
import { toast } from "@/lib/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons";
import type { RuntimeAdapter, RuntimeManifest, RuntimeMode } from "@/lib/compat/runtime-manifest";

const markdownPreviewClass =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:leading-relaxed [&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1";

interface CharacterEditorDialogProps {
  character: Character | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditorField({
  label,
  hint,
  charCount,
  children,
}: {
  label: string;
  hint?: string;
  charCount?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        {charCount !== undefined ? (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {charCount}
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

function defaultRuntimeManifest(): RuntimeManifest {
  return {
    runtimeMode: "native",
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
  };
}

export function CharacterEditorDialog({
  character,
  open,
  onOpenChange,
}: CharacterEditorDialogProps) {
  const { t } = useTranslation();
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const updateAvatar = useCharacterStore((s) => s.updateAvatar);
  const createChat = useChatStore((s) => s.createChat);
  const selectChat = useChatStore((s) => s.selectChat);

  const [saving, setSaving] = useState(false);
  const [bookJson, setBookJson] = useState("");
  const [form, setForm] = useState<Partial<Character>>({});
  const [previewIndex, setPreviewIndex] = useState(0);
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    if (!character || !open) return;
    setForm(character);
    setBookJson(character.characterBook ? JSON.stringify(character.characterBook, null, 2) : "");
    setPreviewIndex(0);
    setDevOpen(false);
  }, [character, open]);

  const tagsText = useMemo(() => (form.tags ?? []).join(", "), [form.tags]);
  const greetings = useMemo(
    () => (form.alternateGreetings ?? []).filter((g) => g !== undefined),
    [form.alternateGreetings],
  );

  const previewGreetings = useMemo(() => {
    const first = (form.firstMes ?? "").trim();
    const alts = greetings.map((g) => g.trim()).filter(Boolean);
    const all = first ? [first, ...alts] : alts;
    return all.length > 0 ? all : [""];
  }, [form.firstMes, greetings]);

  const safePreviewIndex = Math.min(previewIndex, Math.max(0, previewGreetings.length - 1));
  const previewText = previewGreetings[safePreviewIndex] ?? "";

  const patch = (value: Partial<Character>) => setForm((prev) => ({ ...prev, ...value }));

  const patchRuntimeManifest = (value: Partial<RuntimeManifest>) =>
    setForm((prev) => {
      const extensions = prev.extensions ?? {};
      const runtimeManifest = (extensions.runtimeManifest ?? defaultRuntimeManifest()) as RuntimeManifest;
      return {
        ...prev,
        extensions: {
          ...extensions,
          runtimeManifest: { ...runtimeManifest, ...value },
        },
      };
    });

  const patchGreeting = (index: number, text: string) => {
    const next = [...greetings];
    next[index] = text;
    patch({ alternateGreetings: next });
  };

  const addGreeting = () => patch({ alternateGreetings: [...greetings, ""] });

  const removeGreeting = (index: number) => {
    const next = greetings.filter((_, i) => i !== index);
    patch({ alternateGreetings: next });
    if (previewIndex > 0 && previewIndex - 1 >= next.length) {
      setPreviewIndex(Math.max(0, next.length));
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!character) return;
    const file = e.target.files?.[0];
    if (!file) return;
    await updateAvatar(character.id, file);
    const refreshed = useCharacterStore.getState().characters.find((c) => c.id === character.id);
    if (refreshed) patch({ avatar: refreshed.avatar });
    e.target.value = "";
  };

  const buildPayload = (): Partial<Character> | null => {
    let parsedBook: Record<string, unknown> | null = null;
    if (bookJson.trim()) {
      try {
        parsedBook = JSON.parse(bookJson) as Record<string, unknown>;
      } catch {
        toast.error({ title: t("character.bookJsonInvalid") });
        return null;
      }
    }
    return {
      ...form,
      tags: (tagsText || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      alternateGreetings: greetings.map((s) => s.trim()).filter(Boolean),
      characterBook: parsedBook,
    };
  };

  const handleSave = async (options?: { tryChat?: boolean }) => {
    if (!character) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      await updateCharacter(character.id, payload);
      toast.success({ title: t("character.savedSuccess") });
      if (options?.tryChat) {
        const chat = await createChat(character.id);
        await selectChat(chat.id);
        onOpenChange(false);
      }
    } catch (err) {
      toast.error({
        title: t("character.saveFailed"),
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!character) return null;

  const runtimeManifest = (form.extensions?.runtimeManifest ?? defaultRuntimeManifest()) as RuntimeManifest;
  const textareaClass = "min-h-[88px] resize-y text-sm leading-relaxed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(90vh,52rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="text-base">{t("character.editTitle")}</DialogTitle>
          <DialogDescription>{t("character.editDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
            <Tabs defaultValue="basic" className="flex min-h-0 flex-1 flex-col">
              <TabsList variant="line" className="mx-4 mt-3 w-auto shrink-0 justify-start">
                <TabsTrigger value="basic">{t("character.tabBasic")}</TabsTrigger>
                <TabsTrigger value="advanced">{t("character.tabAdvanced")}</TabsTrigger>
                <TabsTrigger value="book">{t("character.tabBook")}</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <TabsContent value="basic" className="mt-0 flex flex-col gap-4">
                  <EditorField label={t("character.name")}>
                    <Input
                      value={form.name ?? ""}
                      onChange={(e) => patch({ name: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.description")}
                    hint={t("character.hintDescription")}
                    charCount={(form.description ?? "").length}
                  >
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(e) => patch({ description: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.personality")}
                    hint={t("character.hintPersonality")}
                    charCount={(form.personality ?? "").length}
                  >
                    <Textarea
                      value={form.personality ?? ""}
                      onChange={(e) => patch({ personality: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.scenario")}
                    hint={t("character.hintScenario")}
                    charCount={(form.scenario ?? "").length}
                  >
                    <Textarea
                      value={form.scenario ?? ""}
                      onChange={(e) => patch({ scenario: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.firstMessage")}
                    hint={t("character.hintFirstMessage")}
                    charCount={(form.firstMes ?? "").length}
                  >
                    <Textarea
                      value={form.firstMes ?? ""}
                      onChange={(e) => patch({ firstMes: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.messageExamples")}
                    hint={t("character.hintMessageExamples")}
                    charCount={(form.mesExample ?? "").length}
                  >
                    <Textarea
                      value={form.mesExample ?? ""}
                      onChange={(e) => patch({ mesExample: e.target.value })}
                      className={`${textareaClass} min-h-[120px] font-mono text-xs`}
                    />
                  </EditorField>

                  <div className="flex flex-col gap-2">
                    <div>
                      <Label className="text-xs font-medium">
                        {t("character.alternateGreetingsTitle")}
                      </Label>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("character.hintAlternateGreetings")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {greetings.map((greeting, index) => (
                        <div key={index} className="flex gap-2">
                          <Textarea
                            value={greeting}
                            onChange={(e) => patchGreeting(index, e.target.value)}
                            placeholder={t("character.alternateGreetingPlaceholder", {
                              n: String(index + 1),
                            })}
                            className="min-h-[64px] flex-1 resize-y text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeGreeting(index)}
                            title={t("character.removeGreeting")}
                          >
                            <HugeiconsIcon icon={Delete01Icon} size={16} strokeWidth={1.5} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit gap-1 text-xs"
                        onClick={addGreeting}
                      >
                        <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.5} />
                        {t("character.addGreeting")}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="mt-0 flex flex-col gap-4">
                  <EditorField
                    label={t("character.systemPrompt")}
                    hint={t("character.hintSystemPrompt")}
                    charCount={(form.systemPrompt ?? "").length}
                  >
                    <Textarea
                      value={form.systemPrompt ?? ""}
                      onChange={(e) => patch({ systemPrompt: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <EditorField
                    label={t("character.postHistoryInstructions")}
                    hint={t("character.hintPostHistory")}
                    charCount={(form.postHistoryInstructions ?? "").length}
                  >
                    <Textarea
                      value={form.postHistoryInstructions ?? ""}
                      onChange={(e) => patch({ postHistoryInstructions: e.target.value })}
                      className={textareaClass}
                    />
                  </EditorField>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <EditorField label={t("character.creator")}>
                      <Input
                        value={form.creator ?? ""}
                        onChange={(e) => patch({ creator: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </EditorField>
                    <EditorField label={t("character.characterVersion")}>
                      <Input
                        value={form.characterVersion ?? ""}
                        onChange={(e) => patch({ characterVersion: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </EditorField>
                  </div>

                  <EditorField label={t("character.creatorNotes")}>
                    <Textarea
                      value={form.creatorNotes ?? ""}
                      onChange={(e) => patch({ creatorNotes: e.target.value })}
                      className="min-h-[72px] resize-y text-sm"
                    />
                  </EditorField>

                  <EditorField label={t("character.tags")}>
                    <Input
                      value={tagsText}
                      onChange={(e) =>
                        patch({
                          tags: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="h-9 text-sm"
                    />
                  </EditorField>

                  <Collapsible open={devOpen} onOpenChange={setDevOpen}>
                    <CollapsibleTrigger className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted">
                      {t("character.developerSection")}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Runtime Mode
                          <select
                            value={runtimeManifest.runtimeMode}
                            onChange={(e) =>
                              patchRuntimeManifest({ runtimeMode: e.target.value as RuntimeMode })
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          >
                            <option value="native">native</option>
                            <option value="compat-sandbox">compat-sandbox</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                          Runtime Adapter
                          <select
                            value={runtimeManifest.adapter ?? "st-generic"}
                            onChange={(e) =>
                              patchRuntimeManifest({ adapter: e.target.value as RuntimeAdapter })
                            }
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          >
                            <option value="st-generic">st-generic</option>
                            <option value="era">era</option>
                            <option value="fate">fate</option>
                            <option value="custom">custom</option>
                          </select>
                        </label>
                      </div>
                      {runtimeManifest.detectedFeatures?.length ? (
                        <p className="text-[11px] text-muted-foreground">
                          {runtimeManifest.detectedFeatures.join(", ")}
                        </p>
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>
                </TabsContent>

                <TabsContent value="book" className="mt-0 flex flex-col gap-2">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t("character.bookJsonHint")}
                  </p>
                  <Textarea
                    value={bookJson}
                    onChange={(e) => setBookJson(e.target.value)}
                    placeholder={t("character.characterBook")}
                    className="min-h-[280px] font-mono text-xs leading-relaxed"
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <aside className="flex min-h-0 flex-col bg-muted/15 lg:max-h-none">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">{t("character.preview")}</p>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <label className="group relative mx-auto cursor-pointer">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-background shadow-sm ring-2 ring-background transition group-hover:opacity-90">
                  {character.avatar || form.avatar ? (
                    <img
                      src={characterApi.avatarUrl(character.id)}
                      alt={form.name ?? character.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-semibold text-primary">
                      {(form.name ?? character.name).charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {t("character.changeAvatar")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    void handleAvatar(e);
                  }}
                />
              </label>

              <p className="text-center text-sm font-semibold">{form.name ?? character.name}</p>

              {(form.description ?? "").trim() ? (
                <p className="line-clamp-4 text-center text-xs leading-relaxed text-muted-foreground">
                  {form.description}
                </p>
              ) : null}

              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {safePreviewIndex === 0
                      ? t("character.previewFirstMessage")
                      : t("character.previewAltGreeting", { n: String(safePreviewIndex) })}
                  </span>
                  {previewGreetings.length > 1 ? (
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7"
                        onClick={() =>
                          setPreviewIndex(
                            (safePreviewIndex - 1 + previewGreetings.length) %
                              previewGreetings.length,
                          )
                        }
                      >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.5} />
                      </Button>
                      <span className="min-w-10 text-center text-[10px] tabular-nums text-muted-foreground">
                        {safePreviewIndex + 1}/{previewGreetings.length}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7"
                        onClick={() =>
                          setPreviewIndex((safePreviewIndex + 1) % previewGreetings.length)
                        }
                      >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-3 text-sm shadow-sm">
                  {previewText.trim() ? (
                    <CompatMarkdown content={previewText} className={markdownPreviewClass} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {t("character.previewEmpty")}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{form.name ?? character.name}</p>
              </div>
            </div>
          </aside>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border px-5 py-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                void handleSave({ tryChat: true });
              }}
            >
              {t("character.saveAndTry")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? t("messages.saving") : t("actions.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
