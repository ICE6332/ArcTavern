"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";
import { useLanguageStore, type Language } from "@/stores/language-store";
import { useSettingsPanelController } from "@/hooks/use-settings-panel-controller";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { ConnectionSettings } from "./connection-settings";
import { MemorySettings } from "./memory-settings";
import { PromptSettings } from "./prompt-settings";
import { SamplingSettings } from "./sampling-settings";
import { WorldInfoSettings } from "./world-info-settings";

type SettingsTab = "connection" | "prompts" | "worldinfo" | "memory";

export function SettingsPanel() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("connection");
  const {
    conn,
    apiKey,
    saving,
    detecting,
    setApiKey,
    handleSaveKey,
    handleTestConnection,
    handleDetectCustomProvider,
  } = useSettingsPanelController(t);

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
