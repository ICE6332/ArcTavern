"use client";

import { useEffect, useRef, useState } from "react";
import { usePresetStore } from "@/stores/preset-store";
import { detectPresetType } from "@/lib/preset-type-detector";
import { presetApi, type Preset } from "@/lib/api/preset";
import { toast } from "@/lib/toast";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PresetSelectorProps {
  apiType: string;
  onPresetApplied?: () => void;
}

export function PresetSelector({ apiType, onPresetApplied }: PresetSelectorProps) {
  const { t } = useTranslation();
  const {
    presets,
    activePresetId,
    loadPresets,
    selectPreset,
    applyPreset,
    deletePreset,
    restorePreset,
    importPreset,
    savePreset,
    collectCurrentSettings,
  } = usePresetStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const saveNameRef = useRef<HTMLInputElement>(null);
  const currentPresets = presets[apiType] ?? [];
  const currentPresetId = activePresetId[apiType] ?? null;
  const activePreset = currentPresets.find((p) => p.id === currentPresetId);
  const getPresetLabel = (preset: Preset) => {
    const baseName = preset.name?.trim() ? preset.name : `Preset ${preset.id}`;
    return preset.isDefault ? `[Default] ${baseName}` : baseName;
  };
  const presetLabelMap = new Map(
    currentPresets.map((preset) => [preset.id.toString(), getPresetLabel(preset)]),
  );

  useEffect(() => {
    void loadPresets(apiType);
  }, [apiType, loadPresets]);

  const handleSelect = (value: string | null) => {
    if (!value) return;
    const id = Number(value);
    selectPreset(apiType, id);
    const preset = currentPresets.find((p) => p.id === id);
    if (preset) {
      applyPreset(preset);
      onPresetApplied?.();
    }
  };

  const handleSaveNew = () => {
    setSavingName("");
    setTimeout(() => saveNameRef.current?.focus(), 0);
  };

  const confirmSaveNew = () => {
    if (!savingName?.trim()) {
      setSavingName(null);
      return;
    }
    const name = savingName.trim();
    setSavingName(null);
    const data = collectCurrentSettings(apiType);
    savePreset(name, apiType, data).then((preset) => {
      selectPreset(apiType, preset.id);
      onPresetApplied?.();
    });
  };

  const handleOverwrite = async () => {
    if (!activePreset || activePreset.isDefault) return;
    const data = collectCurrentSettings(apiType);
    await presetApi.update(activePreset.id, { data: JSON.stringify(data) } as Partial<Preset>);
    await loadPresets(apiType);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const detectedType = detectPresetType(parsed);
      const targetType = detectedType ?? apiType;

      if (detectedType && detectedType !== apiType) {
        const confirmed = window.confirm(
          `This appears to be a "${detectedType}" preset. Import as "${detectedType}" instead of "${apiType}"?`,
        );
        if (!confirmed) return;
      }

      const name = file.name.replace(/\.json$/i, "");
      const preset = await importPreset(name, targetType, parsed);
      selectPreset(targetType, preset.id);
      applyPreset(preset);
      onPresetApplied?.();
      if (targetType !== apiType) {
        toast.success({
          title: t("settings.presetImportSuccess"),
          description: t("settings.presetImportOtherProviderHint", { type: targetType }),
        });
      } else {
        toast.success({
          title: t("settings.presetImportSuccess"),
          description: preset.name?.trim() || name,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error({
        title: t("settings.presetImportFailed"),
        description: message,
      });
    }

    // Reset input
    e.target.value = "";
  };

  const handleExport = async () => {
    if (!currentPresetId) return;
    try {
      const result = await presetApi.export(currentPresetId);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success({
        title: t("settings.presetExportSuccess"),
        description: result.name,
      });
    } catch {
      toast.error({ title: t("settings.presetExportFailed") });
    }
  };

  const handleDelete = async () => {
    if (!activePreset || activePreset.isDefault) return;
    const confirmed = window.confirm(`Delete preset "${activePreset.name}"?`);
    if (!confirmed) return;
    await deletePreset(activePreset.id, apiType);
  };

  const handleRestore = async () => {
    if (!activePreset?.isDefault) return;
    const confirmed = window.confirm(`Restore "${activePreset.name}" to its original default?`);
    if (!confirmed) return;
    await restorePreset(activePreset.id, apiType);
    // Re-apply the restored preset
    const refreshed = usePresetStore
      .getState()
      .presets[apiType]?.find((p) => p.id === activePreset.id);
    if (refreshed) {
      applyPreset(refreshed);
      onPresetApplied?.();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Select value={currentPresetId?.toString() ?? ""} onValueChange={handleSelect}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue>
              {(value) => {
                const key = value == null ? "" : String(value);
                if (!key) return "Select preset...";
                return presetLabelMap.get(key) ?? key;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {currentPresets.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()} label={getPresetLabel(p)}>
                {getPresetLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {savingName !== null && (
        <div className="flex items-center gap-1">
          <Input
            ref={saveNameRef}
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmSaveNew();
              if (e.key === "Escape") setSavingName(null);
            }}
            placeholder={t("settings.presetNamePlaceholder")}
            className="h-6 flex-1 text-xs"
          />
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={confirmSaveNew}>
            OK
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={() => setSavingName(null)}
          >
            {t("actions.cancel")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px]"
          onClick={handleSaveNew}
        >
          Save New
        </Button>
        {activePreset && !activePreset.isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => {
              void handleOverwrite();
            }}
          >
            Overwrite
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleImport}>
          Import
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px]"
          onClick={() => {
            void handleExport();
          }}
          disabled={!currentPresetId}
        >
          Export
        </Button>
        {activePreset && !activePreset.isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] text-destructive"
            onClick={() => {
              void handleDelete();
            }}
          >
            Delete
          </Button>
        )}
        {activePreset?.isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => {
              void handleRestore();
            }}
          >
            Restore
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          void handleFileSelected(e);
        }}
      />
    </div>
  );
}
