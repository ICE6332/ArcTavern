"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useCharacterStore } from "@/stores/character-store";

export default function Home() {
  const fetchCharacters = useCharacterStore((s) => s.fetchCharacters);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <ChatPanel />
      <SettingsPanel />
    </div>
  );
}
