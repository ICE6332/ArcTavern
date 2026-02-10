"use client";

import { useState } from "react";
import { useConnectionStore, DEFAULT_MODELS, type Provider } from "@/stores/connection-store";
import { secretApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "mistral", label: "Mistral" },
  { value: "custom", label: "Custom" },
];

const SECRET_KEY_MAP: Record<Provider, string> = {
  openai: "api_key_openai",
  anthropic: "api_key_anthropic",
  google: "api_key_google",
  openrouter: "api_key_openrouter",
  mistral: "api_key_mistral",
  custom: "api_key_custom",
};

export function SettingsPanel() {
  const conn = useConnectionStore();
  const [collapsed, setCollapsed] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const models = DEFAULT_MODELS[conn.provider] ?? [];

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await secretApi.set(SECRET_KEY_MAP[conn.provider], apiKey.trim());
      setApiKey("");
    } catch (e) {
      console.error("Failed to save API key:", e);
    } finally {
      setSaving(false);
    }
  };

  if (collapsed) {
    return (
      <aside className="flex w-10 flex-col items-center border-l border-border bg-sidebar pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground"
          title="Open settings"
        >
          ⚙
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 flex-col border-l border-border bg-sidebar">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-medium">Settings</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Provider */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Provider</Label>
            <select
              value={conn.provider}
              onChange={(e) => conn.setProvider(e.target.value as Provider)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Model</Label>
            {models.length > 0 ? (
              <select
                value={conn.model}
                onChange={(e) => conn.setModel(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={conn.model}
                onChange={(e) => conn.setModel(e.target.value)}
                placeholder="Model name"
                className="h-9"
              />
            )}
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">API Key</Label>
            <div className="flex gap-1.5">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key..."
                className="h-9"
              />
              <Button size="sm" className="h-9 shrink-0" onClick={handleSaveKey} disabled={saving}>
                Save
              </Button>
            </div>
          </div>

          {/* Reverse Proxy */}
          {conn.provider === "custom" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Reverse Proxy URL</Label>
              <Input
                value={conn.reverseProxy}
                onChange={(e) => conn.setReverseProxy(e.target.value)}
                placeholder="https://..."
                className="h-9"
              />
            </div>
          )}

          <Separator />

          {/* Sampling Parameters */}
          <p className="text-xs font-medium text-muted-foreground">Sampling</p>

          <SliderField label="Temperature" value={conn.temperature} onChange={conn.setTemperature} min={0} max={2} step={0.05} />
          <SliderField label="Max Tokens" value={conn.maxTokens} onChange={conn.setMaxTokens} min={1} max={32768} step={1} isInt />
          <SliderField label="Top P" value={conn.topP} onChange={conn.setTopP} min={0} max={1} step={0.05} />
          <SliderField label="Top K" value={conn.topK} onChange={conn.setTopK} min={0} max={500} step={1} isInt />
          <SliderField label="Freq. Penalty" value={conn.frequencyPenalty} onChange={conn.setFrequencyPenalty} min={-2} max={2} step={0.05} />
          <SliderField label="Pres. Penalty" value={conn.presencePenalty} onChange={conn.setPresencePenalty} min={-2} max={2} step={0.05} />
        </div>
      </div>
    </aside>
  );
}

function SliderField({
  label, value, onChange, min, max, step, isInt,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; isInt?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {isInt ? value : value.toFixed(2)}
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
