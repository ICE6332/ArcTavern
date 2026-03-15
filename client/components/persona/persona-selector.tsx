"use client";

import { usePersonaStore } from "@/stores/persona-store";
import { useTranslation } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PersonaSelector() {
  const { t } = useTranslation();
  const { personas, activePersonaId, setActivePersona } = usePersonaStore();

  return (
    <Select
      value={activePersonaId ?? "none"}
      onValueChange={(v) => setActivePersona(v === "none" ? null : v)}
    >
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue placeholder={t("persona.none")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t("persona.none")}</SelectItem>
        {personas.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.isDefault ? ` ${t("persona.default")}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
