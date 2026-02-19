"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { PersonaSelector } from "@/components/persona/persona-selector";
import { PersonaEditor } from "@/components/persona/persona-editor";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useCharacterStore } from "@/stores/character-store";
import { useTagStore } from "@/stores/tag-store";
import { usePersonaStore } from "@/stores/persona-store";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
  const { t } = useTranslation();
  const fetchCharacters = useCharacterStore((s) => s.fetchCharacters);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const fetchPersonas = usePersonaStore((s) => s.fetchPersonas);
  const { personas, activePersonaId } = usePersonaStore();
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);

  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;

  useEffect(() => {
    fetchCharacters();
    fetchTags();
    fetchPersonas();
  }, [fetchCharacters, fetchTags, fetchPersonas]);

  return (
    <SidebarProvider
      className="h-screen overflow-hidden"
      style={{ "--sidebar-width": "340px", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
    >
      <Sidebar />

      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <SidebarTrigger className="-ml-1" />
          <span className="text-xs text-muted-foreground">{t("persona.label")}</span>
          <div className="w-48">
            <PersonaSelector />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowPersonaEditor(!showPersonaEditor)}
          >
            {showPersonaEditor ? "Close" : activePersonaId ? "Edit" : "New"}
          </Button>
        </div>
        {showPersonaEditor && (
          <div className="border-b border-border bg-sidebar">
            <PersonaEditor
              persona={activePersona}
              onClose={() => {
                setShowPersonaEditor(false);
                fetchPersonas();
              }}
            />
          </div>
        )}
        <ChatPanel />
      </SidebarInset>

      <SettingsPanel />
    </SidebarProvider>
  );
}
