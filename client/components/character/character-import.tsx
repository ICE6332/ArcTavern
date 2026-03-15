"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { toast } from "@/lib/toast";

export function CharacterImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importCharacter = useCharacterStore((s) => s.importCharacter);
  const { fetchChats, createChat } = useChatStore();
  const [loading, setLoading] = useState(false);

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const character = await importCharacter(file);
      toast.success({ title: `Imported "${character.name}"` });
      // Auto-create a chat for the imported character
      await fetchChats(character.id);
      const chatState = useChatStore.getState();
      if (chatState.chats.length === 0) {
        await createChat(character.id);
      } else {
        await useChatStore.getState().selectChat(chatState.chats[0].id);
      }
    } catch (err) {
      toast.error({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.json,.yaml,.yml"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={handlePick}
        disabled={loading}
      >
        {loading ? "Importing..." : "Import"}
      </Button>
    </>
  );
}
