"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRegexStore } from "@/stores/regex-store";
import { useCharacterStore } from "@/stores/character-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useTranslation } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Add01Icon,
  Delete02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import type { RegexScriptData } from "@/lib/compat/regex-engine";

type NavState = { level: "list" } | { level: "editor"; scriptId: string };

export function RegexSettings() {
  const { t } = useTranslation();
  const [nav, setNav] = useState<NavState>({ level: "list" });

  const {
    globalScripts,
    characterScripts,
    scope,
    loading,
    setScope,
    fetchGlobalScripts,
    setCharacterScripts,
    addScript,
    toggleScript,
  } = useRegexStore(
    useShallow((s) => ({
      globalScripts: s.globalScripts,
      characterScripts: s.characterScripts,
      scope: s.scope,
      loading: s.loading,
      setScope: s.setScope,
      fetchGlobalScripts: s.fetchGlobalScripts,
      setCharacterScripts: s.setCharacterScripts,
      addScript: s.addScript,
      toggleScript: s.toggleScript,
    })),
  );

  const characters = useCharacterStore((s) => s.characters);
  const selectedId = useCharacterStore((s) => s.selectedId);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const character = useMemo(
    () => (selectedId ? (characters.find((c) => c.id === selectedId) ?? null) : null),
    [characters, selectedId],
  );

  // Load global scripts on mount
  useEffect(() => {
    void fetchGlobalScripts();
  }, [fetchGlobalScripts]);

  // Sync character scripts when character changes
  useEffect(() => {
    if (character) {
      const scripts = character.extensions?.regex_scripts;
      setCharacterScripts(Array.isArray(scripts) ? (scripts as RegexScriptData[]) : []);
    } else {
      setCharacterScripts([]);
      if (scope === "character") setScope("global");
    }
    setNav({ level: "list" });
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scripts = scope === "global" ? globalScripts : characterScripts;

  const persistCurrentScope = useCallback(async () => {
    if (scope === "global") {
      await useRegexStore.getState().saveGlobalScripts();
    } else if (character) {
      const updated = useRegexStore.getState().characterScripts;
      await updateCharacter(character.id, {
        extensions: { ...character.extensions, regex_scripts: updated },
      });
    }
  }, [scope, character, updateCharacter]);

  const handleAdd = useCallback(() => {
    const id = addScript();
    setNav({ level: "editor", scriptId: id });
  }, [addScript]);

  const handleToggle = useCallback(
    async (id: string) => {
      toggleScript(id);
      await persistCurrentScope();
    },
    [toggleScript, persistCurrentScope],
  );

  // === LEVEL 1: Script Editor ===
  if (nav.level === "editor") {
    return (
      <ScriptEditorView
        scriptId={nav.scriptId}
        scope={scope}
        character={character}
        onBack={() => setNav({ level: "list" })}
      />
    );
  }

  // === LEVEL 0: Script List ===
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{t("regex.title")}</p>

      {character && (
        <Select value={scope} onValueChange={(v) => setScope(v as "global" | "character")}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">{t("regex.scopeGlobal")}</SelectItem>
            <SelectItem value="character">
              {t("regex.scopeCharacter", { name: character.name })}
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("messages.loading")}</p>
      ) : scripts.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("regex.noScripts")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
              onClick={() => setNav({ level: "editor", scriptId: script.id! })}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${script.disabled ? "bg-muted-foreground/30" : "bg-green-500"}`}
              />
              <span className="min-w-0 flex-1 truncate">
                {script.scriptName || t("regex.untitled")}
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="sm"
                  checked={!script.disabled}
                  onCheckedChange={() => void handleToggle(script.id!)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAdd}>
        <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1" />
        {t("regex.addScript")}
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Script Editor View
// ────────────────────────────────────────────────────────────────

interface ScriptEditorProps {
  scriptId: string;
  scope: "global" | "character";
  character: { id: number; name: string; extensions: Record<string, unknown> } | null;
  onBack: () => void;
}

function ScriptEditorView({ scriptId, scope, character, onBack }: ScriptEditorProps) {
  const { t } = useTranslation();
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const persistCurrentScope = useCallback(async () => {
    if (scope === "global") {
      await useRegexStore.getState().saveGlobalScripts();
    } else if (character) {
      const updated = useRegexStore.getState().characterScripts;
      await updateCharacter(character.id, {
        extensions: { ...character.extensions, regex_scripts: updated },
      });
    }
  }, [scope, character, updateCharacter]);

  const script = useRegexStore((s) => {
    const list = scope === "global" ? s.globalScripts : s.characterScripts;
    return list.find((sc) => sc.id === scriptId) ?? null;
  });

  const [name, setName] = useState(script?.scriptName ?? "");
  const [findRegex, setFindRegex] = useState(script?.findRegex ?? "");
  const [replaceString, setReplaceString] = useState(script?.replaceString ?? "");
  const [trimStrings, setTrimStrings] = useState(script?.trimStrings?.join(", ") ?? "");
  const [placementUserInput, setPlacementUserInput] = useState(
    script?.placement?.includes(1) ?? false,
  );
  const [placementAiOutput, setPlacementAiOutput] = useState(
    script?.placement?.includes(2) ?? true,
  );
  const [enabled, setEnabled] = useState(!script?.disabled);
  const [markdownOnly, setMarkdownOnly] = useState(script?.markdownOnly ?? false);
  const [promptOnly, setPromptOnly] = useState(script?.promptOnly ?? false);
  const [runOnEdit, setRunOnEdit] = useState(script?.runOnEdit ?? false);
  const [minDepth, setMinDepth] = useState(script?.minDepth?.toString() ?? "");
  const [maxDepth, setMaxDepth] = useState(script?.maxDepth?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const regexValid = useMemo(() => {
    if (!findRegex) return null;
    try {
      const match = findRegex.match(/^\/(.+)\/([gimsuy]*)$/);
      if (match) new RegExp(match[1], match[2]);
      else new RegExp(findRegex);
      return true;
    } catch {
      return false;
    }
  }, [findRegex]);

  const handleSave = useCallback(async () => {
    const placement: number[] = [];
    if (placementUserInput) placement.push(1);
    if (placementAiOutput) placement.push(2);

    const data: Partial<RegexScriptData> = {
      scriptName: name,
      findRegex,
      replaceString,
      trimStrings: trimStrings
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      placement,
      disabled: !enabled,
      markdownOnly,
      promptOnly,
      runOnEdit,
      minDepth: minDepth ? Number(minDepth) : null,
      maxDepth: maxDepth ? Number(maxDepth) : null,
    };

    setSaving(true);
    try {
      useRegexStore.getState().updateScript(scriptId, data);
      await persistCurrentScope();
      toast.success({ title: t("messages.success") });
    } catch {
      toast.error({ title: t("messages.failed") });
    } finally {
      setSaving(false);
    }
  }, [
    scriptId,
    name,
    findRegex,
    replaceString,
    trimStrings,
    placementUserInput,
    placementAiOutput,
    enabled,
    markdownOnly,
    promptOnly,
    runOnEdit,
    minDepth,
    maxDepth,
    persistCurrentScope,
    t,
  ]);

  const handleDelete = useCallback(async () => {
    useRegexStore.getState().deleteScript(scriptId);
    await persistCurrentScope();
    toast.success({ title: t("regex.deleted") });
    onBack();
  }, [scriptId, persistCurrentScope, onBack, t]);

  if (!script) {
    onBack();
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
        {t("regex.editScript")}
      </button>

      <Separator />

      {/* Script Name */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("regex.scriptName")}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          placeholder={t("regex.scriptName")}
        />
      </div>

      {/* Find Regex */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("regex.findRegex")}</Label>
        <Input
          value={findRegex}
          onChange={(e) => setFindRegex(e.target.value)}
          className={`h-8 font-mono text-sm ${regexValid === false ? "border-destructive" : ""}`}
          placeholder={t("regex.findRegexPlaceholder")}
        />
        {regexValid === true && (
          <span className="text-xs text-green-500">{t("regex.validPattern")}</span>
        )}
        {regexValid === false && (
          <span className="text-xs text-destructive">{t("regex.invalidPattern")}</span>
        )}
      </div>

      {/* Replace String */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("regex.replaceString")}</Label>
        <textarea
          value={replaceString}
          onChange={(e) => setReplaceString(e.target.value)}
          className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          placeholder="$1, $<name>, {{match}}"
        />
      </div>

      {/* Trim Strings */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("regex.trimStrings")}</Label>
        <Input
          value={trimStrings}
          onChange={(e) => setTrimStrings(e.target.value)}
          className="h-8 text-sm"
          placeholder={t("regex.trimStringsPlaceholder")}
        />
      </div>

      {/* Placement */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("regex.placement")}</Label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={placementUserInput}
              onChange={(e) => setPlacementUserInput(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {t("regex.placementUserInput")}
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={placementAiOutput}
              onChange={(e) => setPlacementAiOutput(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {t("regex.placementAiOutput")}
          </label>
        </div>
      </div>

      {/* Enabled */}
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        {t("regex.enabled")}
      </label>

      {/* Advanced Options */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
          {t("regex.advanced")}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-2 pt-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={markdownOnly}
                onChange={(e) => setMarkdownOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              {t("regex.markdownOnly")}
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={promptOnly}
                onChange={(e) => setPromptOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              {t("regex.promptOnly")}
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={runOnEdit}
                onChange={(e) => setRunOnEdit(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              {t("regex.runOnEdit")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("regex.minDepth")}</Label>
                <Input
                  type="number"
                  value={minDepth}
                  onChange={(e) => setMinDepth(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="—"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("regex.maxDepth")}</Label>
                <Input
                  type="number"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="—"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? t("messages.saving") : t("messages.save")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={() => void handleDelete()}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </Button>
      </div>
    </div>
  );
}
