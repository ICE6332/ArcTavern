"use client";

import { useMemo, useState } from "react";
import { useCharacterStore } from "@/stores/character-store";
import { useChatStore } from "@/stores/chat-store";
import { useGroupStore } from "@/stores/group-store";
import { Button } from "@/components/ui/button";
import { CharacterList } from "@/components/character/character-list";
import { CharacterImport } from "@/components/character/character-import";
import { CharacterEditor } from "@/components/character/character-editor";
import { CharacterExport } from "@/components/character/character-export";
import { TagFilter } from "@/components/tags/tag-filter";
import { GroupList } from "@/components/group/group-list";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, MessageMultiple01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";

type SidebarTab = "characters" | "chats" | "groups";

export function Sidebar() {
  const { t } = useTranslation();
  const {
    characters,
    selectedId,
    selectCharacter,
    loading,
    createCharacter,
    deleteCharacter,
    duplicateCharacter,
    exportCharacter,
  } = useCharacterStore();
  const { chats, fetchChats, selectChat, createChat, deleteChat, currentChatId } = useChatStore();
  const { createGroup, selectGroup } = useGroupStore();
  const [tab, setTab] = useState<SidebarTab>("characters");

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId],
  );

  const handleSelectCharacter = async (id: number) => {
    selectCharacter(id);
    await fetchChats(id);
    const chatState = useChatStore.getState();
    if (chatState.chats.length > 0) {
      await selectChat(chatState.chats[0].id);
    } else {
      await createChat(id);
    }
  };

  const handleNewCharacter = async () => {
    const created = await createCharacter({
      name: `Character ${characters.length + 1}`,
      description: "",
    });
    await handleSelectCharacter(created.id);
  };

  const handleNewChat = async () => {
    if (!selectedId) return;
    const chat = await createChat(selectedId);
    await selectChat(chat.id);
    setTab("chats");
  };

  const handleDeleteChat = async (chatId: number) => {
    if (!selectedId) return;
    const chat = chats.find((item) => item.id === chatId);
    const chatName = chat?.name || `${t("sidebar.chatDefault")} #${chatId}`;
    const confirmed = window.confirm(`Delete chat "${chatName}"?`);
    if (!confirmed) return;

    const wasCurrentChat = currentChatId === chatId;
    try {
      await deleteChat(chatId);
      toast.success({ title: t("sidebar.chatDeleted") ?? "Chat deleted" });
    } catch {
      toast.error({ title: t("sidebar.chatDeleteFailed") ?? "Failed to delete chat" });
      return;
    }

    if (!wasCurrentChat) return;

    const nextChats = useChatStore.getState().chats;
    if (nextChats.length > 0) {
      await selectChat(nextChats[0].id);
      return;
    }

    const created = await createChat(selectedId);
    await selectChat(created.id);
  };

  return (
    <SidebarPrimitive collapsible="icon">
      {/* Tab nav: row when expanded, column when icon-collapsed */}
      <SidebarHeader className="border-b border-border p-1.5">
        <SidebarMenu className="flex-col gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              isActive={tab === "characters"}
              onClick={() => setTab("characters")}
              tooltip={t("sidebar.characters")}
            >
              <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
              <span>{t("sidebar.characters")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              isActive={tab === "chats"}
              onClick={() => setTab("chats")}
              tooltip={t("sidebar.chats")}
              disabled={!selectedId}
            >
              <HugeiconsIcon icon={MessageMultiple01Icon} strokeWidth={2} />
              <span>{t("sidebar.chats")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              isActive={tab === "groups"}
              onClick={() => setTab("groups")}
              tooltip={t("sidebar.groups")}
            >
              <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
              <span>{t("sidebar.groups")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden flex-1 overflow-y-auto scrollbar-hide p-1.5">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("sidebar.loading")}
            </div>
          ) : tab === "characters" ? (
            <div className="flex flex-col gap-2">
              <TagFilter />
              <CharacterList
                characters={characters}
                selectedId={selectedId}
                onSelect={(id) => {
                  void handleSelectCharacter(id);
                }}
                onDuplicate={(id) => void duplicateCharacter(id)}
                onDelete={(id) => {
                  void (async () => {
                    try {
                      await deleteCharacter(id);
                      toast.success({ title: t("sidebar.characterDeleted") ?? "Character deleted" });
                    } catch {
                      toast.error({
                        title: t("sidebar.characterDeleteFailed") ?? "Failed to delete character",
                      });
                    }
                  })();
                }}
                onExport={(id) => void exportCharacter(id, "png")}
              />
              <CharacterEditor character={selectedCharacter} />
            </div>
          ) : tab === "groups" ? (
            <GroupList
              onSelectGroup={(id) => {
                void selectGroup(id);
              }}
              onCreateGroup={() => {
                void createGroup({ name: `Group ${Date.now()}` });
              }}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("sidebar.chats")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    void handleNewChat();
                  }}
                >
                  {t("sidebar.newChat")}
                </Button>
              </div>
              {chats.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {t("sidebar.noChats")}
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex items-start gap-1 rounded-md px-2 py-1.5 transition-colors ${
                      chat.id === currentChatId
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <button
                      onClick={() => void selectChat(chat.id)}
                      className="min-w-0 flex-1 text-left text-sm"
                    >
                      <p className="truncate">
                        {chat.name || `${t("sidebar.chatDefault")} #${chat.id}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {chat.updatedAt ? new Date(chat.updatedAt).toLocaleString() : ""}
                      </p>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteChat(chat.id)}
                    >
                      {t("actions.delete")}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: horizontal action buttons, hidden when icon-collapsed */}
      <SidebarFooter className="group-data-[collapsible=icon]:hidden border-t border-border p-1.5">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => void handleNewCharacter()}
          >
            {t("sidebar.newCharacter")}
          </Button>
          <CharacterImport />
          {selectedId && <CharacterExport characterId={selectedId} />}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </SidebarPrimitive>
  );
}
