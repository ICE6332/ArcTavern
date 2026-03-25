"use client";

import { useEffect, useState } from "react";
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
import { localEmbeddingApi, type LocalModelStatus } from "@/lib/api/ai";
import type { RagSettings } from "@/lib/api/rag";
import { useTranslation } from "@/lib/i18n";
import { useRagStore } from "@/stores/rag-store";
import { toast } from "@/lib/toast";
import { SliderField } from "./slider-field";

const EMBEDDING_PROVIDERS: Array<{ value: string; labelKey?: string; label?: string }> = [
  { value: "", labelKey: "memory.providerAuto" },
  { value: "local", labelKey: "memory.providerLocal" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "mistral", label: "Mistral" },
  { value: "openrouter", label: "OpenRouter" },
];

const INSERTION_POSITIONS: Array<{ value: string; labelKey: string }> = [
  { value: "before_char", labelKey: "memory.posBeforeChar" },
  { value: "after_char", labelKey: "memory.posAfterChar" },
  { value: "at_depth", labelKey: "memory.posAtDepth" },
];

export function MemorySettings() {
  const rag = useRagStore();
  const fetchSettings = rag.fetchSettings;
  const { t } = useTranslation();
  const [localStatus, setLocalStatus] = useState<LocalModelStatus | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const isLocal = rag.settings?.embeddingProvider === "local";

  useEffect(() => {
    if (isLocal) {
      void localEmbeddingApi.getStatus().then(setLocalStatus);
    }
  }, [isLocal]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await localEmbeddingApi.download();
      const status = await localEmbeddingApi.getStatus();
      setLocalStatus(status);
    } catch {
      toast.error({ title: t("messages.failed") });
    } finally {
      setDownloading(false);
    }
  };

  if (rag.loading || !rag.settings) {
    return <div className="text-xs text-muted-foreground">{t("messages.loading")}</div>;
  }

  const s = rag.settings;
  const update = (data: Partial<RagSettings>) => {
    void rag.updateSettings(data);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t("memory.enableRag")}</Label>
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("memory.embeddingProvider")}</Label>
        <Select
          value={s.embeddingProvider}
          onValueChange={(v) => update({ embeddingProvider: v ?? "" })}
          disabled={!s.enabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMBEDDING_PROVIDERS.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {provider.labelKey ? t(provider.labelKey) : provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLocal && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2">
          {downloading || localStatus?.loading ? (
            <span className="text-xs text-muted-foreground">{t("memory.downloading")}</span>
          ) : localStatus?.downloaded ? (
            <span className="text-xs text-green-500">{t("memory.modelReady")}</span>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {t("memory.modelNotDownloaded")}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-6 text-xs"
                onClick={handleDownload}
              >
                {t("memory.downloadModel")}
              </Button>
            </>
          )}
        </div>
      )}

      {!isLocal && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("memory.embeddingModel")}</Label>
            <Input
              value={s.embeddingModel}
              onChange={(e) => update({ embeddingModel: e.target.value })}
              placeholder="e.g. text-embedding-3-small"
              disabled={!s.enabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("memory.embeddingUrl")}</Label>
            <Input
              value={s.embeddingReverseProxy ?? ""}
              onChange={(e) => update({ embeddingReverseProxy: e.target.value })}
              placeholder={t("memory.embeddingUrlPlaceholder")}
              disabled={!s.enabled}
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("memory.scope")}</Label>
        <Select
          value={s.scope}
          onValueChange={(v) => update({ scope: v as "chat" | "character" })}
          disabled={!s.enabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chat">{t("memory.scopeChat")}</SelectItem>
            <SelectItem value="character">{t("memory.scopeCharacter")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <SliderField
        label={t("memory.maxResults")}
        value={s.maxResults}
        onChange={(v) => update({ maxResults: v })}
        min={1}
        max={50}
        step={1}
        isInt
      />
      <SliderField
        label={t("memory.minSimilarity")}
        value={s.minScore}
        onChange={(v) => update({ minScore: v })}
        min={0}
        max={1}
        step={0.05}
      />
      <SliderField
        label={t("memory.tokenBudget")}
        value={s.maxTokenBudget}
        onChange={(v) => update({ maxTokenBudget: v })}
        min={128}
        max={4096}
        step={128}
        isInt
      />

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("memory.insertionPosition")}</Label>
        <Select
          value={s.insertionPosition}
          onValueChange={(v) =>
            update({ insertionPosition: v as "before_char" | "after_char" | "at_depth" })
          }
          disabled={!s.enabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INSERTION_POSITIONS.map((position) => (
              <SelectItem key={position.value} value={position.value}>
                {t(position.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {s.insertionPosition === "at_depth" && (
        <SliderField
          label={t("memory.insertionDepth")}
          value={s.insertionDepth}
          onChange={(v) => update({ insertionDepth: v })}
          min={1}
          max={20}
          step={1}
          isInt
        />
      )}

      <Separator />

      <SliderField
        label={t("memory.chunkSize")}
        value={s.chunkSize}
        onChange={(v) => update({ chunkSize: v })}
        min={200}
        max={4000}
        step={100}
        isInt
      />
      <SliderField
        label={t("memory.chunkOverlap")}
        value={s.chunkOverlap}
        onChange={(v) => update({ chunkOverlap: v })}
        min={0}
        max={1000}
        step={50}
        isInt
      />
    </div>
  );
}
