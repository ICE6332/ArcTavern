"use client";

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
import { useConnectionStore } from "@/stores/connection-store";
import type { Language } from "@/stores/language-store";
import { SliderField } from "./slider-field";

type ConnectionStore = ReturnType<typeof useConnectionStore.getState>;

interface SamplingSettingsProps {
  conn: ConnectionStore;
  language: Language;
  setLanguage: (language: Language) => void;
}

export function SamplingSettings({ conn, language, setLanguage }: SamplingSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium text-muted-foreground">{t("settings.sampling")}</p>

      <SliderField
        label={t("settings.temperature")}
        value={conn.temperature}
        onChange={conn.setTemperature}
        min={0}
        max={2}
        step={0.05}
      />
      <SliderField
        label={t("settings.maxTokens")}
        value={conn.maxTokens}
        onChange={conn.setMaxTokens}
        min={1}
        max={32768}
        step={1}
        isInt
      />
      <SliderField
        label={t("settings.topP")}
        value={conn.topP}
        onChange={conn.setTopP}
        min={0}
        max={1}
        step={0.05}
      />
      <SliderField
        label={t("settings.topK")}
        value={conn.topK}
        onChange={conn.setTopK}
        min={0}
        max={500}
        step={1}
        isInt
      />
      <SliderField
        label={t("settings.freqPenalty")}
        value={conn.frequencyPenalty}
        onChange={conn.setFrequencyPenalty}
        min={-2}
        max={2}
        step={0.05}
      />
      <SliderField
        label={t("settings.presPenalty")}
        value={conn.presencePenalty}
        onChange={conn.setPresencePenalty}
        min={-2}
        max={2}
        step={0.05}
      />
      <SliderField
        label={t("settings.topA")}
        value={conn.topA}
        onChange={conn.setTopA}
        min={0}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t("settings.minP")}
        value={conn.minP}
        onChange={conn.setMinP}
        min={0}
        max={1}
        step={0.01}
      />
      <SliderField
        label={t("settings.repPenalty")}
        value={conn.repetitionPenalty}
        onChange={conn.setRepetitionPenalty}
        min={1}
        max={3}
        step={0.05}
      />
      <SliderField
        label={t("settings.maxContext")}
        value={conn.maxContext}
        onChange={conn.setMaxContext}
        min={512}
        max={200000}
        step={512}
        isInt
      />
      <SliderField
        label={t("settings.seed")}
        value={conn.seed}
        onChange={conn.setSeed}
        min={-1}
        max={99999}
        step={1}
        isInt
      />

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Label className="text-xs">{t("settings.generativeUi")}</Label>
          <span className="text-[0.625rem] text-muted-foreground">
            {t("settings.generativeUiHint")}
          </span>
        </div>
        <input
          type="checkbox"
          checked={conn.openUiEnabled}
          onChange={(e) => conn.setOpenUiEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("settings.language")}</Label>
        <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
