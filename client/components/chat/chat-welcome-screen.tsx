"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, FileImportIcon, Add01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useChatStore } from "@/stores/chat-store";
import { useCharacterStore } from "@/stores/character-store";
import { useTranslation } from "@/lib/i18n";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";

export function ChatWelcomeScreen() {
  const { t } = useTranslation();
  const { createCharacter, fetchCharacters } = useCharacterStore(
    useShallow((s) => ({ createCharacter: s.createCharacter, fetchCharacters: s.fetchCharacters })),
  );

  const greetings = [
    t("welcomeScreen.greeting1"),
    t("welcomeScreen.greeting2"),
    t("welcomeScreen.greeting3"),
    t("welcomeScreen.greeting4"),
    t("welcomeScreen.greeting5"),
    t("welcomeScreen.greeting6"),
  ];

  const [greeting] = useState(() => greetings[Math.floor(Math.random() * greetings.length)]);

  const handleCreateCharacter = async () => {
    const created = await createCharacter({
      name: "New Character",
      description: "",
    });
    useCharacterStore.getState().selectCharacter(created.id);
    const { createChat, selectChat } = useChatStore.getState();
    const chat = await createChat(created.id);
    await selectChat(chat.id);
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            <Shimmer duration={3} spread={1.5}>{`✦ ${greeting}`}</Shimmer>
          </h1>
          <p className="text-sm text-muted-foreground">{t("welcomeScreen.hint")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <PromptSuggestion onClick={() => void fetchCharacters()}>
            <HugeiconsIcon icon={UserIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">{t("welcomeScreen.browseCharacters")}</span>
          </PromptSuggestion>
          <PromptSuggestion onClick={() => void handleCreateCharacter()}>
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">{t("welcomeScreen.createCharacter")}</span>
          </PromptSuggestion>
          <PromptSuggestion>
            <HugeiconsIcon icon={FileImportIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">{t("welcomeScreen.importCharacter")}</span>
          </PromptSuggestion>
          <PromptSuggestion>
            <HugeiconsIcon icon={UserGroupIcon} size={14} strokeWidth={1.5} />
            <span className="ml-1.5">{t("welcomeScreen.groupChat")}</span>
          </PromptSuggestion>
        </div>
      </div>
    </main>
  );
}
