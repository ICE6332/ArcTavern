"use client";

import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n";
import { PresetSelector } from "./preset-selector";
import { PromptManager } from "./prompt-manager";
import { QuickReplyEditor } from "./quick-reply-editor";

export function PromptSettings() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <PromptManager />

      <Separator />

      <p className="text-xs font-medium text-muted-foreground">
        {t("settings.systemPromptPreset")}
      </p>
      <PresetSelector apiType="sysprompt" />

      <Separator />

      <p className="text-xs font-medium text-muted-foreground">{t("settings.contextTemplate")}</p>
      <PresetSelector apiType="context" />

      <Separator />

      <QuickReplyEditor />
    </div>
  );
}
