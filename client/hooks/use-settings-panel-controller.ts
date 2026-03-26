"use client";

import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { aiApi } from "@/lib/api/ai";
import { secretApi } from "@/lib/api/secret";
import type { Provider } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useConnectionStore } from "@/stores/connection-store";

const SECRET_KEY_MAP: Record<Provider, string> = {
  openai: "api_key_openai",
  anthropic: "api_key_anthropic",
  google: "api_key_google",
  openrouter: "api_key_openrouter",
  mistral: "api_key_mistral",
  custom: "api_key_custom",
};

export function useSettingsPanelController(t: (key: string) => string) {
  const conn = useConnectionStore();

  const {
    provider,
    model,
    reverseProxy,
    customModels,
    topK,
    frequencyPenalty,
    presencePenalty,
    apiKeyConfigured,
  } = useConnectionStore(
    useShallow((s) => ({
      provider: s.provider,
      model: s.model,
      reverseProxy: s.reverseProxy,
      customModels: s.customModels,
      topK: s.topK,
      frequencyPenalty: s.frequencyPenalty,
      presencePenalty: s.presencePenalty,
      apiKeyConfigured: s.apiKeyConfigured,
    })),
  );

  const setApiKeyConfigured = useConnectionStore((s) => s.setApiKeyConfigured);
  const setConnectionStatus = useConnectionStore((s) => s.setConnectionStatus);
  const setCustomModels = useConnectionStore((s) => s.setCustomModels);
  const setModel = useConnectionStore((s) => s.setModel);

  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    secretApi
      .listKeys()
      .then((keys) => {
        for (const p of Object.keys(SECRET_KEY_MAP) as Provider[]) {
          setApiKeyConfigured(p, keys.includes(SECRET_KEY_MAP[p]));
        }
      })
      .catch(() => undefined);
  }, [setApiKeyConfigured]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) return;

    setSaving(true);
    try {
      await secretApi.set(SECRET_KEY_MAP[provider], apiKey.trim());
      setApiKeyConfigured(provider, true);
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
  }, [apiKey, provider, setApiKeyConfigured, t]);

  const handleTestConnection = useCallback(async () => {
    if (provider === "custom") {
      if (!reverseProxy.trim()) {
        toast.error({ title: t("settings.pleaseEnterEndpointFirst") });
        return;
      }
      if (!(customModels.length > 0 && Boolean(model.trim()))) {
        toast.error({ title: t("settings.pleaseDetectConnectionFirst") });
        return;
      }
    }

    setConnectionStatus("testing", t("settings.testing"));
    try {
      await aiApi.complete({
        provider,
        model,
        messages: [{ role: "user", content: "Say OK." }],
        temperature: 0.1,
        maxTokens: 16,
        topP: 1,
        topK,
        frequencyPenalty,
        presencePenalty,
        reverseProxy: reverseProxy || undefined,
      });
      setConnectionStatus("ok", t("settings.connectionSuccess"));
      toast.success({ title: t("settings.connectionSuccess") });
    } catch (error: unknown) {
      const message = getErrorMessage(error, t("settings.connectionFailed"));
      setConnectionStatus("error", message);
      toast.error({ title: t("settings.connectionFailed"), description: message });
    }
  }, [
    provider,
    model,
    reverseProxy,
    customModels,
    topK,
    frequencyPenalty,
    presencePenalty,
    setConnectionStatus,
    t,
  ]);

  const handleDetectCustomProvider = useCallback(async () => {
    const baseUrl = reverseProxy.trim();
    const keyInput = apiKey.trim();

    if (!baseUrl) {
      toast.error({ title: t("settings.pleaseEnterEndpoint") });
      return;
    }
    if (!keyInput && !apiKeyConfigured.custom) {
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
        setCustomModels(modelIds);

        if (modelIds.length > 0) {
          if (!model || !modelIds.includes(model)) {
            setModel(modelIds[0]);
          }
          toast.success({
            title: t("settings.connectionDetected"),
            description: `${result.message} · ${modelIds.length} ${t("settings.models")}`,
          });
        } else {
          setModel("");
          toast.success({
            title: t("settings.connectionDetected"),
            description: `${result.message} · ${t("settings.noModelsReturned")}`,
          });
        }
        return;
      }

      setCustomModels([]);
      toast.error({ title: t("settings.detectionFailed"), description: result.message });
    } catch (error: unknown) {
      setCustomModels([]);
      toast.error({
        title: t("settings.detectionFailed"),
        description: getErrorMessage(error, t("settings.connectionFailed")),
      });
    } finally {
      setDetecting(false);
    }
  }, [apiKey, reverseProxy, apiKeyConfigured, model, setCustomModels, setModel, t]);

  return {
    conn,
    apiKey,
    saving,
    detecting,
    setApiKey,
    handleSaveKey,
    handleTestConnection,
    handleDetectCustomProvider,
  };
}
