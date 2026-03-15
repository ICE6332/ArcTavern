import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PersonaEditor } from "@/components/persona/persona-editor";
import { PersonaSelector } from "@/components/persona/persona-selector";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "@/lib/i18n";
import { useCharacterStore } from "@/stores/character-store";
import { usePersonaStore } from "@/stores/persona-store";
import { useTagStore } from "@/stores/tag-store";
import { Toaster } from "sileo";

export function AppShell() {
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
    <>
      <SidebarProvider
        className="h-screen overflow-hidden"
        style={
          {
            "--sidebar-width": "340px",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
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
                  void fetchPersonas();
                }}
              />
            </div>
          )}
          <ChatPanel />
        </SidebarInset>

        <SettingsPanel />
      </SidebarProvider>

      <Toaster
        position="top-center"
        options={{
          fill: "oklch(0.21 0.006 285.885)",
          styles: { description: "text-white/70!" },
        }}
      />
    </>
  );
}
