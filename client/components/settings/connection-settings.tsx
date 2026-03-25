"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useTranslation } from "@/lib/i18n";
import {
  DEFAULT_MODELS,
  useConnectionStore,
  type CustomApiFormat,
} from "@/stores/connection-store";
import type { Provider } from "@/lib/api/types";
import { PresetSelector } from "./preset-selector";
import { Separator } from "@/components/ui/separator";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "providers.openai" },
  { value: "anthropic", label: "providers.anthropic" },
  { value: "google", label: "providers.google" },
  { value: "openrouter", label: "providers.openrouter" },
  { value: "mistral", label: "providers.mistral" },
  { value: "custom", label: "providers.custom" },
];

type ConnectionStore = ReturnType<typeof useConnectionStore.getState>;

interface ConnectionSettingsProps {
  conn: ConnectionStore;
  apiKey: string;
  saving: boolean;
  detecting: boolean;
  onApiKeyChange: (value: string) => void;
  onSaveKey: () => void;
  onDetectCustomProvider: () => void;
  onTestConnection: () => void;
}

export function ConnectionSettings({
  conn,
  apiKey,
  saving,
  detecting,
  onApiKeyChange,
  onSaveKey,
  onDetectCustomProvider,
  onTestConnection,
}: ConnectionSettingsProps) {
  const { t } = useTranslation();
  const models = useMemo(() => DEFAULT_MODELS[conn.provider] ?? [], [conn.provider]);
  const hasCustomApiKey = Boolean(apiKey.trim() || conn.apiKeyConfigured.custom);
  const canDetectCustom = Boolean(conn.reverseProxy.trim()) && hasCustomApiKey;
  const customReadyForTest = conn.customModels.length > 0 && Boolean(conn.model.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("settings.provider")}</Label>
        <Select value={conn.provider} onValueChange={(v) => conn.setProvider(v as Provider)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((provider) => (
              <SelectItem key={provider.value} value={provider.value}>
                {t(provider.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("settings.model")}</Label>
        {conn.provider === "custom" && conn.customModels.length > 0 ? (
          <Combobox value={conn.model} onValueChange={(v) => conn.setModel(v ?? "")}>
            <ComboboxInput placeholder={t("settings.searchModels")} />
            <ComboboxContent>
              <ComboboxEmpty>{t("settings.noModelsFound")}</ComboboxEmpty>
              <ComboboxList>
                {conn.customModels.map((model) => (
                  <ComboboxItem key={model} value={model}>
                    {model}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : models.length > 0 ? (
          <Combobox value={conn.model} onValueChange={(v) => conn.setModel(v ?? "")}>
            <ComboboxInput placeholder={t("settings.searchModels")} />
            <ComboboxContent>
              <ComboboxEmpty>{t("settings.noModelsFound")}</ComboboxEmpty>
              <ComboboxList>
                {models.map((model) => (
                  <ComboboxItem key={model} value={model}>
                    {model}
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <Input
            value={conn.model}
            onChange={(e) => conn.setModel(e.target.value)}
            placeholder={
              conn.provider === "custom"
                ? t("settings.detectConnectionModels")
                : t("settings.modelName")
            }
            className="h-9"
          />
        )}
        {conn.provider === "custom" && conn.customModels.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("settings.customDetectHint")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">
          API Key{" "}
          {conn.apiKeyConfigured[conn.provider] ? t("settings.configured") : t("settings.notSet")}
        </Label>
        <div className="flex gap-1.5">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={t("settings.enterApiKey")}
            className="h-9"
          />
          <Button size="sm" className="h-9 shrink-0" onClick={onSaveKey} disabled={saving}>
            {t("actions.save")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("settings.customEndpoint")}</Label>
        <Input
          value={conn.reverseProxy}
          onChange={(e) => conn.setReverseProxy(e.target.value)}
          placeholder={t("settings.endpointPlaceholder")}
          className="h-9"
        />
      </div>

      {conn.provider === "custom" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t("settings.apiFormat")}</Label>
            <select
              value={conn.customApiFormat}
              onChange={(e) => conn.setCustomApiFormat(e.target.value as CustomApiFormat)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="openai-compatible">{t("settings.apiFormatOpenAiCompatible")}</option>
              <option value="google">{t("settings.apiFormatGoogleNative")}</option>
              <option value="openai">{t("settings.apiFormatOpenAiNative")}</option>
              <option value="anthropic">{t("settings.apiFormatAnthropicNative")}</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onDetectCustomProvider}
            disabled={detecting || !canDetectCustom}
          >
            {detecting ? t("settings.detecting") : t("settings.detectConnectionModels")}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onTestConnection}
        disabled={conn.provider === "custom" && !customReadyForTest}
      >
        {t("settings.testConnection")}
      </Button>

      <Separator />

      <p className="text-xs font-medium text-muted-foreground">{t("settings.completionPreset")}</p>
      <PresetSelector apiType="openai" />
    </div>
  );
}
