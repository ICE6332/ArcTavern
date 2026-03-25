"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { aiApi, localEmbeddingApi, type LocalModelStatus } from "@/lib/api/ai";
import { secretApi } from "@/lib/api/secret";
import type { RagSettings } from "@/lib/api/rag";
import type { Provider } from "@/lib/api/types";
import { DEFAULT_MODELS, useConnectionStore } from "@/stores/connection-store";
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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { PromptManager } from "./prompt-manager";
import { PresetSelector } from "./preset-selector";
import { QuickReplyEditor } from "./quick-reply-editor";
import { useTranslation } from "@/lib/i18n";
import { useLanguageStore, type Language } from "@/stores/language-store";
import { useRagStore } from "@/stores/rag-store";
import { toast } from "@/lib/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

type SettingsTab = "connection" | "prompts" | "memory";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "providers.openai" },
  { value: "anthropic", label: "providers.anthropic" },
  { value: "google", label: "providers.google" },
  { value: "openrouter", label: "providers.openrouter" },
  { value: "mistral", label: "providers.mistral" },
  { value: "custom", label: "providers.custom" },
];

const SECRET_KEY_MAP: Record<Provider, string> = {
  openai: "api_key_openai",
  anthropic: "api_key_anthropic",
  google: "api_key_google",
  openrouter: "api_key_openrouter",
  mistral: "api_key_mistral",
  custom: "api_key_custom",
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function SettingsPanel() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const conn = useConnectionStore();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("connection");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const models = useMemo(() => DEFAULT_MODELS[conn.provider] ?? [], [conn.provider]);
  const hasCustomApiKey = Boolean(apiKey.trim() || conn.apiKeyConfigured.custom);
  const canDetectCustom = Boolean(conn.reverseProxy.trim()) && hasCustomApiKey;
  const customReadyForTest = conn.customModels.length > 0 && Boolean(conn.model.trim());

  useEffect(() => {
    secretApi
      .listKeys()
      .then((keys) => {
        for (const provider of Object.keys(SECRET_KEY_MAP) as Provider[]) {
          conn.setApiKeyConfigured(provider, keys.includes(SECRET_KEY_MAP[provider]));
        }
      })
      .catch(() => undefined);
  }, [conn]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await secretApi.set(SECRET_KEY_MAP[conn.provider], apiKey.trim());
      conn.setApiKeyConfigured(conn.provider, true);
      setApiKey("");
      toast.success({ title: t("settings.apiKeySaved") });
    } catch (err) {
      toast.error({
        title: "Failed to save API key",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (conn.provider === "custom") {
      if (!conn.reverseProxy.trim()) {
        toast.error({ title: "Please enter custom API endpoint first" });
        return;
      }
      if (!customReadyForTest) {
        toast.error({ title: "Please detect connection and models first" });
        return;
      }
    }

    conn.setConnectionStatus("testing", t("settings.testing"));
    try {
      await aiApi.complete({
        provider: conn.provider,
        model: conn.model,
        messages: [{ role: "user", content: "Say OK." }],
        temperature: 0.1,
        maxTokens: 16,
        topP: 1,
        topK: conn.topK,
        frequencyPenalty: conn.frequencyPenalty,
        presencePenalty: conn.presencePenalty,
        reverseProxy: conn.reverseProxy || undefined,
      });
      conn.setConnectionStatus("ok", t("settings.connectionSuccess"));
      toast.success({ title: t("settings.connectionSuccess") });
    } catch (error: unknown) {
      const msg = getErrorMessage(error, t("settings.connectionFailed"));
      conn.setConnectionStatus("error", msg);
      toast.error({ title: t("settings.connectionFailed"), description: msg });
    }
  };

  const handleDetectCustomProvider = async () => {
    const baseUrl = conn.reverseProxy.trim();
    const keyInput = apiKey.trim();

    if (!baseUrl) {
      toast.error({ title: "Please enter API endpoint" });
      return;
    }
    if (!keyInput && !conn.apiKeyConfigured.custom) {
      toast.error({ title: "Please enter API key and save it first" });
      return;
    }

    setDetecting(true);

    try {
      const result = await aiApi.healthCheck({
        provider: "custom",
        apiKey: keyInput || undefined,
        baseUrl,
      });

      if (result.status === "ok") {
        const modelIds = (result.models ?? [])
          .map((m) => m.id)
          .filter((id): id is string => Boolean(id));
        conn.setCustomModels(modelIds);

        if (modelIds.length > 0) {
          if (!conn.model || !modelIds.includes(conn.model)) {
            conn.setModel(modelIds[0]);
          }
          toast.success({
            title: "Connection detected",
            description: `${result.message} · ${modelIds.length} models`,
          });
        } else {
          conn.setModel("");
          toast.success({
            title: "Connection detected",
            description: `${result.message} · no models returned`,
          });
        }
      } else {
        conn.setCustomModels([]);
        toast.error({ title: "Detection failed", description: result.message });
      }
    } catch (error: unknown) {
      conn.setCustomModels([]);
      toast.error({
        title: "Detection failed",
        description: getErrorMessage(error, "Connection failed"),
      });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="relative flex h-full shrink-0">
      <div className="flex w-10 flex-col items-center border-l border-border bg-sidebar pt-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={collapsed ? t("settings.openSettings") : "Close settings"}
        >
          <HugeiconsIcon
            icon={collapsed ? Settings01Icon : Cancel01Icon}
            size={16}
            strokeWidth={1.5}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex h-full flex-col overflow-hidden border-l border-border bg-sidebar"
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex gap-1">
                <Button
                  variant={settingsTab === "connection" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSettingsTab("connection")}
                >
                  {t("settings.connection")}
                </Button>
                <Button
                  variant={settingsTab === "prompts" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSettingsTab("prompts")}
                >
                  {t("settings.prompts")}
                </Button>
                <Button
                  variant={settingsTab === "memory" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSettingsTab("memory")}
                >
                  {t("settings.memory")}
                </Button>
              </div>
            </div>

            <div className="min-w-[320px] flex-1 overflow-y-auto p-4">
              {settingsTab === "prompts" ? (
                <div className="flex flex-col gap-4">
                  <PromptManager />

                  <Separator />

                  <p className="text-xs font-medium text-muted-foreground">System Prompt Preset</p>
                  <PresetSelector apiType="sysprompt" />

                  <Separator />

                  <p className="text-xs font-medium text-muted-foreground">Context Template</p>
                  <PresetSelector apiType="context" />

                  <Separator />

                  <QuickReplyEditor />
                </div>
              ) : settingsTab === "memory" ? (
                <MemorySettings />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">{t("settings.provider")}</Label>
                    <Select
                      value={conn.provider}
                      onValueChange={(v) => conn.setProvider(v as Provider)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {t(p.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">{t("settings.model")}</Label>
                    {conn.provider === "custom" && conn.customModels.length > 0 ? (
                      <Combobox value={conn.model} onValueChange={(v) => conn.setModel(v ?? "")}>
                        <ComboboxInput placeholder="Search models..." />
                        <ComboboxContent>
                          <ComboboxEmpty>No models found.</ComboboxEmpty>
                          <ComboboxList>
                            {conn.customModels.map((m) => (
                              <ComboboxItem key={m} value={m}>
                                {m}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    ) : models.length > 0 ? (
                      <Combobox value={conn.model} onValueChange={(v) => conn.setModel(v ?? "")}>
                        <ComboboxInput placeholder="Search models..." />
                        <ComboboxContent>
                          <ComboboxEmpty>No models found.</ComboboxEmpty>
                          <ComboboxList>
                            {models.map((m) => (
                              <ComboboxItem key={m} value={m}>
                                {m}
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
                            ? "Detect connection to load model list"
                            : t("settings.modelName")
                        }
                        className="h-9"
                      />
                    )}
                    {conn.provider === "custom" && conn.customModels.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Step 1: Detect connection & models. Step 2: Test connection.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">
                      API Key{" "}
                      {conn.apiKeyConfigured[conn.provider]
                        ? t("settings.configured")
                        : t("settings.notSet")}
                    </Label>
                    <div className="flex gap-1.5">
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t("settings.enterApiKey")}
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        className="h-9 shrink-0"
                        onClick={() => {
                          void handleSaveKey();
                        }}
                        disabled={saving}
                      >
                        Save
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
                        <Label className="text-xs">API Format</Label>
                        <select
                          value={conn.customApiFormat}
                          onChange={(e) =>
                            conn.setCustomApiFormat(
                              e.target.value as
                                | "openai-compatible"
                                | "google"
                                | "openai"
                                | "anthropic",
                            )
                          }
                          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                        >
                          <option value="openai-compatible">OpenAI Compatible</option>
                          <option value="google">Google Gemini (Native)</option>
                          <option value="openai">OpenAI (Native)</option>
                          <option value="anthropic">Anthropic (Native)</option>
                        </select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          void handleDetectCustomProvider();
                        }}
                        disabled={detecting || !canDetectCustom}
                      >
                        {detecting ? "Detecting..." : "Detect Connection & Models"}
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      void handleTestConnection();
                    }}
                    disabled={conn.provider === "custom" && !customReadyForTest}
                  >
                    Test Connection
                  </Button>

                  <Separator />

                  <p className="text-xs font-medium text-muted-foreground">Completion Preset</p>
                  <PresetSelector apiType="openai" />

                  <Separator />

                  <p className="text-xs font-medium text-muted-foreground">
                    {t("settings.sampling")}
                  </p>
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
                    label="Top A"
                    value={conn.topA}
                    onChange={conn.setTopA}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                  <SliderField
                    label="Min P"
                    value={conn.minP}
                    onChange={conn.setMinP}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                  <SliderField
                    label="Rep. Penalty"
                    value={conn.repetitionPenalty}
                    onChange={conn.setRepetitionPenalty}
                    min={1}
                    max={3}
                    step={0.05}
                  />
                  <SliderField
                    label="Max Context"
                    value={conn.maxContext}
                    onChange={conn.setMaxContext}
                    min={512}
                    max={200000}
                    step={512}
                    isInt
                  />
                  <SliderField
                    label="Seed (-1=random)"
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
                      <Label className="text-xs">Generative UI (OpenUI)</Label>
                      <span className="text-[0.625rem] text-muted-foreground">
                        AI can respond with interactive components
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
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

const EMBEDDING_PROVIDERS = [
  { value: "", labelKey: "memory.providerAuto" },
  { value: "local", labelKey: "memory.providerLocal" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "mistral", label: "Mistral" },
  { value: "openrouter", label: "OpenRouter" },
];

const INSERTION_POSITIONS = [
  { value: "before_char", labelKey: "memory.posBeforeChar" },
  { value: "after_char", labelKey: "memory.posAfterChar" },
  { value: "at_depth", labelKey: "memory.posAtDepth" },
];

function MemorySettings() {
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
            {EMBEDDING_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.labelKey ? t(p.labelKey) : p.label}
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
              <span className="text-xs text-muted-foreground">{t("memory.modelNotDownloaded")}</span>
              <Button size="sm" variant="outline" className="ml-auto h-6 text-xs" onClick={handleDownload}>
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
            {INSERTION_POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {t(p.labelKey)}
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

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  isInt,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {isInt ? Math.round(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
    </div>
  );
}
