"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { aiApi } from "@/lib/api/ai";
import { secretApi } from "@/lib/api/secret";
import type { Provider } from "@/lib/api/types";
import { useTranslation } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";
import { useLanguageStore, type Language } from "@/stores/language-store";
import { useConnectionStore } from "@/stores/connection-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { ConnectionSettings } from "./connection-settings";
import { MemorySettings } from "./memory-settings";
import { PromptSettings } from "./prompt-settings";
import { SamplingSettings } from "./sampling-settings";
import { WorldInfoSettings } from "./world-info-settings";

type SettingsTab = "connection" | "prompts" | "worldinfo" | "memory";

const SECRET_KEY_MAP: Record<Provider, string> = {
  openai: "api_key_openai",
  anthropic: "api_key_anthropic",
  google: "api_key_google",
  openrouter: "api_key_openrouter",
  mistral: "api_key_mistral",
  custom: "api_key_custom",
};

export function SettingsPanel() {
  const { t } = useTranslation();
  const conn = useConnectionStore();
  const { language, setLanguage } = useLanguageStore();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("connection");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

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
    } catch (error: unknown) {
      toast.error({
        title: t("settings.failedToSaveApiKey"),
        description: getErrorMessage(error, t("settings.connectionFailed")),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (conn.provider === "custom") {
      if (!conn.reverseProxy.trim()) {
        toast.error({ title: t("settings.pleaseEnterEndpointFirst") });
        return;
      }
      if (!(conn.customModels.length > 0 && Boolean(conn.model.trim()))) {
        toast.error({ title: t("settings.pleaseDetectConnectionFirst") });
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
      const message = getErrorMessage(error, t("settings.connectionFailed"));
      conn.setConnectionStatus("error", message);
      toast.error({ title: t("settings.connectionFailed"), description: message });
    }
  };

  const handleDetectCustomProvider = async () => {
    const baseUrl = conn.reverseProxy.trim();
    const keyInput = apiKey.trim();

    if (!baseUrl) {
      toast.error({ title: t("settings.pleaseEnterEndpoint") });
      return;
    }
    if (!keyInput && !conn.apiKeyConfigured.custom) {
      toast.error({ title: t("settings.pleaseEnterApiKeySaveFirst") });
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
            title: t("settings.connectionDetected"),
            description: `${result.message} · ${modelIds.length} ${t("settings.models")}`,
          });
        } else {
          conn.setModel("");
          toast.success({
            title: t("settings.connectionDetected"),
            description: `${result.message} · ${t("settings.noModelsReturned")}`,
          });
        }
      } else {
        conn.setCustomModels([]);
        toast.error({ title: t("settings.detectionFailed"), description: result.message });
      }
    } catch (error: unknown) {
      conn.setCustomModels([]);
      toast.error({
        title: t("settings.detectionFailed"),
        description: getErrorMessage(error, t("settings.connectionFailed")),
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
          title={collapsed ? t("settings.openSettings") : t("ui.close")}
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
                  variant={settingsTab === "worldinfo" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setSettingsTab("worldinfo")}
                >
                  {t("settings.worldInfo")}
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
              {settingsTab === "worldinfo" ? (
                <WorldInfoSettings />
              ) : settingsTab === "prompts" ? (
                <PromptSettings />
              ) : settingsTab === "memory" ? (
                <MemorySettings />
              ) : (
                <div className="flex flex-col gap-4">
                  <ConnectionSettings
                    conn={conn}
                    apiKey={apiKey}
                    saving={saving}
                    detecting={detecting}
                    onApiKeyChange={setApiKey}
                    onSaveKey={handleSaveKey}
                    onDetectCustomProvider={handleDetectCustomProvider}
                    onTestConnection={handleTestConnection}
                  />
                  <SamplingSettings
                    conn={conn}
                    language={language}
                    setLanguage={setLanguage as (language: Language) => void}
                  />
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
