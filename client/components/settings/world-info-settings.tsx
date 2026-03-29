"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWorldInfoStore } from "@/stores/world-info-store";
import { useCharacterStore } from "@/stores/character-store";
import { worldInfoApi, type WorldInfoEntry, type WIEmbeddingSettings } from "@/lib/api/world-info";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Add01Icon,
  Delete02Icon,
  Link04Icon,
  FileImportIcon,
} from "@hugeicons/core-free-icons";

type NavState =
  | { level: "books" }
  | { level: "entries"; bookId: number }
  | { level: "entry"; bookId: number; entryId: number };

const POSITIONS = [
  { value: "before_char", label: "worldInfo.posBefore" },
  { value: "after_char", label: "worldInfo.posAfter" },
  { value: "before_example", label: "worldInfo.posBeforeExample" },
  { value: "after_example", label: "worldInfo.posAfterExample" },
  { value: "at_depth", label: "worldInfo.posAtDepth" },
  { value: "before_an", label: "worldInfo.posBeforeAN" },
  { value: "after_an", label: "worldInfo.posAfterAN" },
];

const SELECT_LOGIC_OPTIONS = [
  { value: 0, label: "AND ANY" },
  { value: 1, label: "NOT ALL" },
  { value: 2, label: "NOT ANY" },
  { value: 3, label: "AND ALL" },
];

const EMBEDDING_PROVIDERS: { value: string; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "mistral", label: "Mistral" },
  { value: "local", label: "Local" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_WI_EMBEDDING_CLIENT: WIEmbeddingSettings = {
  provider: "local",
  model: "jina-embeddings-v2-base-zh",
  chunkSize: 1000,
  chunkOverlap: 200,
  minScore: 0.3,
  hybridMode: true,
};

function WorldInfoEmbeddingPanel({ bookId }: { bookId: number }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<WIEmbeddingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const s = await worldInfoApi.getEmbeddingSettings();
        if (!cancelled) setSettings(s);
      } catch {
        if (!cancelled) setSettings({ ...DEFAULT_WI_EMBEDDING_CLIENT });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (loading || !settings) {
    return <p className="text-xs text-muted-foreground">{loading ? t("messages.loading") : "—"}</p>;
  }

  const updateLocal = (patch: Partial<WIEmbeddingSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await worldInfoApi.saveEmbeddingSettings(settings);
      setSettings(saved);
      toast.success({ title: t("worldInfo.embeddingSettingsSaved") });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error({ title: t("messages.failed"), description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleVectorize = async () => {
    setVectorizing(true);
    try {
      await worldInfoApi.vectorizeBook(bookId);
      toast.success({ title: t("worldInfo.vectorizeBookDone") });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error({ title: t("messages.failed"), description: message });
    } finally {
      setVectorizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/50 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">{t("worldInfo.embeddingTitle")}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("worldInfo.embeddingProvider")}</Label>
          <Select
            value={settings.provider}
            onValueChange={(v) => {
              if (v) updateLocal({ provider: v });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMBEDDING_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("worldInfo.embeddingModel")}</Label>
          <Input
            value={settings.model}
            onChange={(e) => updateLocal({ model: e.target.value })}
            className="h-8 text-xs"
            placeholder="jina-embeddings-v2-base-zh"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">
          {t("worldInfo.embeddingMinScore")}: {settings.minScore.toFixed(2)}
        </Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.minScore}
          onChange={(e) => updateLocal({ minScore: Number(e.target.value) })}
          className="h-2 w-full accent-primary"
        />
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={settings.hybridMode}
          onChange={(e) => updateLocal({ hybridMode: e.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        {t("worldInfo.embeddingHybrid")}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => {
            void handleSaveSettings();
          }}
          disabled={saving}
        >
          {saving ? t("messages.saving") : t("worldInfo.saveEmbeddingSettings")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            void handleVectorize();
          }}
          disabled={vectorizing}
        >
          {vectorizing ? t("worldInfo.revectorizing") : t("worldInfo.revectorizeAll")}
        </Button>
      </div>
    </div>
  );
}

export function WorldInfoSettings() {
  const { t } = useTranslation();
  const [nav, setNav] = useState<NavState>({ level: "books" });

  const {
    books,
    entries,
    activeBookIds,
    loading,
    fetchBooks,
    selectBook,
    createBook,
    deleteBook,
    createEntry,
    deleteEntry,
    updateEntry,
    updateBook,
    toggleBookActive,
    importBook,
  } = useWorldInfoStore();

  const lorebookImportRef = useRef<HTMLInputElement>(null);
  const characters = useCharacterStore((s) => s.characters);

  useEffect(() => {
    void fetchBooks();
  }, [fetchBooks]);

  // Find which characters are bound to which books
  const bookCharacterMap = new Map<number, string>();
  for (const c of characters) {
    if (c.worldInfoBookId) {
      bookCharacterMap.set(c.worldInfoBookId, c.name);
    }
  }

  const goBack = useCallback(() => {
    if (nav.level === "entry") {
      setNav({ level: "entries", bookId: nav.bookId });
    } else if (nav.level === "entries") {
      setNav({ level: "books" });
    }
  }, [nav]);

  const openBook = useCallback(
    async (bookId: number) => {
      await selectBook(bookId);
      setNav({ level: "entries", bookId });
    },
    [selectBook],
  );

  const openEntry = useCallback((bookId: number, entryId: number) => {
    setNav({ level: "entry", bookId, entryId });
  }, []);

  const handleCreateBook = useCallback(async () => {
    const book = await createBook({ name: t("worldInfo.newBook") });
    await selectBook(book.id);
    setNav({ level: "entries", bookId: book.id });
  }, [createBook, selectBook, t]);

  const handleLorebookFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const fallbackName = file.name.replace(/\.json$/i, "") || t("worldInfo.newBook");
        const name = (typeof parsed.name === "string" && parsed.name.trim()) || fallbackName;
        await importBook({ ...parsed, name });
        await fetchBooks();
        toast.success({
          title: t("worldInfo.importBookSuccess"),
          description: name,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error({
          title: t("worldInfo.importBookFailed"),
          description: message,
        });
      } finally {
        e.target.value = "";
      }
    },
    [importBook, fetchBooks, t],
  );

  const handleDeleteBook = useCallback(
    async (id: number) => {
      await deleteBook(id);
      if (nav.level !== "books") setNav({ level: "books" });
    },
    [deleteBook, nav.level],
  );

  const handleCreateEntry = useCallback(
    async (bookId: number) => {
      const entry = await createEntry(bookId, {
        keys: [t("worldInfo.newKeyword")],
        content: "",
        comment: t("worldInfo.newEntry"),
      });
      setNav({ level: "entry", bookId, entryId: entry.id });
    },
    [createEntry, t],
  );

  // === LEVEL 2: Entry Editor ===
  if (nav.level === "entry") {
    const entry = entries.find((e) => e.id === nav.entryId);
    if (!entry) {
      setNav({ level: "entries", bookId: nav.bookId });
      return null;
    }
    return (
      <EntryEditorView
        entry={entry}
        onBack={goBack}
        onSave={(data) => updateEntry(nav.entryId, data)}
        onDelete={async () => {
          await deleteEntry(nav.entryId);
          goBack();
        }}
      />
    );
  }

  // === LEVEL 1: Entry List ===
  if (nav.level === "entries") {
    const book = books.find((b) => b.id === nav.bookId);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </button>
          <Input
            value={book?.name ?? ""}
            onChange={(e) => updateBook(nav.bookId, { name: e.target.value })}
            className="h-7 text-sm font-medium"
          />
        </div>

        <Separator />

        <WorldInfoEmbeddingPanel bookId={nav.bookId} />

        {loading ? (
          <p className="text-xs text-muted-foreground">{t("messages.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("worldInfo.noEntries")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
                onClick={() => openEntry(nav.bookId, entry.id)}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${entry.enabled ? "bg-green-500" : "bg-muted-foreground/30"}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {entry.comment || entry.keys.join(", ") || `#${entry.uid}`}
                </span>
                {entry.constant && (
                  <span className="shrink-0 rounded bg-primary/10 px-1 text-[0.6rem] text-primary">
                    C
                  </span>
                )}
                {entry.vectorized && (
                  <span className="shrink-0 rounded bg-muted px-1 text-[0.6rem] text-muted-foreground">
                    V
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleCreateEntry(nav.bookId)}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1" />
          {t("worldInfo.addEntry")}
        </Button>
      </div>
    );
  }

  // === LEVEL 0: Book List ===
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{t("worldInfo.title")}</p>

      {loading && books.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("messages.loading")}</p>
      ) : books.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("worldInfo.noBooks")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {books.map((book) => {
            const isActive = activeBookIds.includes(book.id);
            const boundChar = bookCharacterMap.get(book.id);
            return (
              <div
                key={book.id}
                className="flex items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleBookActive(book.id)}
                  className="h-3.5 w-3.5 accent-primary"
                  title={t("worldInfo.toggleActive")}
                />
                <span
                  className="min-w-0 flex-1 cursor-pointer truncate text-sm hover:text-primary"
                  onClick={() => openBook(book.id)}
                >
                  {book.name}
                </span>
                {boundChar && (
                  <span
                    className="shrink-0 text-muted-foreground"
                    title={`${t("worldInfo.boundTo")} ${boundChar}`}
                  >
                    <HugeiconsIcon icon={Link04Icon} size={12} />
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteBook(book.id);
                  }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCreateBook}>
          <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1" />
          {t("worldInfo.newBook")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => lorebookImportRef.current?.click()}
        >
          <HugeiconsIcon icon={FileImportIcon} size={14} className="mr-1" />
          {t("worldInfo.importBook")}
        </Button>
        <input
          ref={lorebookImportRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void handleLorebookFile(e);
          }}
        />
      </div>
    </div>
  );
}

function EntryEditorView({
  entry,
  onBack,
  onSave,
  onDelete,
}: {
  entry: WorldInfoEntry;
  onBack: () => void;
  onSave: (data: Partial<WorldInfoEntry>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(entry.comment);
  const [keys, setKeys] = useState(entry.keys.join(", "));
  const [secondaryKeys, setSecondaryKeys] = useState(entry.secondaryKeys.join(", "));
  const [content, setContent] = useState(entry.content);
  const [enabled, setEnabled] = useState(entry.enabled);
  const [constant, setConstant] = useState(entry.constant);
  const [selective, setSelective] = useState(entry.selective);
  const [selectLogic, setSelectLogic] = useState(entry.selectLogic);
  const [position, setPosition] = useState(entry.position);
  const [priority, setPriority] = useState(entry.priority);
  const [depth, setDepth] = useState(entry.depth);
  const [role, setRole] = useState(entry.role);
  const [vectorized, setVectorized] = useState(entry.vectorized);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVectorized(entry.vectorized);
  }, [entry.id, entry.vectorized]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        comment,
        keys: keys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        secondaryKeys: secondaryKeys
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        content,
        enabled,
        constant,
        selective,
        selectLogic,
        position,
        priority,
        depth,
        role,
        vectorized,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </button>
        <span className="text-sm font-medium">{t("worldInfo.editEntry")}</span>
      </div>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("worldInfo.comment")}</Label>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("worldInfo.keys")}</Label>
        <Input
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
          placeholder={t("worldInfo.keysPlaceholder")}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("worldInfo.content")}</Label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("worldInfo.enabled")}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={constant}
            onChange={(e) => setConstant(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("worldInfo.constant")}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={selective}
            onChange={(e) => setSelective(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("worldInfo.selective")}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={vectorized}
            onChange={(e) => setVectorized(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("worldInfo.vectorized")}
        </label>
      </div>

      {selective && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("worldInfo.secondaryKeys")}</Label>
            <Input
              value={secondaryKeys}
              onChange={(e) => setSecondaryKeys(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("worldInfo.selectLogic")}</Label>
            <Select value={String(selectLogic)} onValueChange={(v) => setSelectLogic(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECT_LOGIC_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("worldInfo.position")}</Label>
        <Select
          value={position}
          onValueChange={(v) => {
            if (v) setPosition(v);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {t(p.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("worldInfo.priority")}</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>
        {position === "at_depth" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("worldInfo.depth")}</Label>
            <Input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t("worldInfo.role")}</Label>
          <Select value={String(role)} onValueChange={(v) => setRole(Number(v))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">System</SelectItem>
              <SelectItem value="1">User</SelectItem>
              <SelectItem value="2">Assistant</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button size="sm" className="h-7 flex-1 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? t("messages.saving") : t("messages.save")}
        </Button>
        <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onDelete}>
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </Button>
      </div>
    </div>
  );
}
