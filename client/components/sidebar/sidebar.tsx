"use client";

import { useState } from "react";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CharacterCard } from "@/components/character/character-card";

export function Sidebar() {
  const { characters, selectedId, selectCharacter, loading } = useCharacterStore();
  const { chats, fetchChats, selectChat, createChat, currentChatId } = useChatStore();
  const [search, setSearch] = useState("");

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelectCharacter = async (id: number) => {
    selectCharacter(id);
    await fetchChats(id);
  };

  const handleNewChat = async () => {
    if (!selectedId) return;
    const chat = await createChat(selectedId);
    await selectChat(chat.id);
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-sidebar">
      {/* Search */}
      <div className="p-3">
        <Input
          placeholder="Search characters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <Separator />

      {/* Character list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <p>No characters yet</p>
            <p className="text-xs">Create one to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                isSelected={char.id === selectedId}
                onClick={() => handleSelectCharacter(char.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Chat list for selected character */}
      {selectedId && (
        <div className="flex flex-col gap-1 p-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Chats</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleNewChat}>
              + New
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  chat.id === currentChatId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {chat.name || `Chat #${chat.id}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
