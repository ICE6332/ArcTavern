"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGroupStore } from "@/stores/group-store";
import { useConnectionStore } from "@/stores/connection-store";
import { groupApi } from "@/lib/api/group";
import { useTranslation } from "@/lib/i18n";
import { MemberSelector } from "./member-selector";

interface GroupChatPanelProps {
  groupId: string;
  chatId: number;
  onNewMessage: () => void;
}

export function GroupChatPanel({ groupId, chatId, onNewMessage }: GroupChatPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [manualCharId, setManualCharId] = useState<number | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const { groups } = useGroupStore();
  const connection = useConnectionStore();
  const group = groups.find((g) => g.id === groupId);
  const isManualMode = group?.activationStrategy === 2;

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setCurrentSpeaker(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of groupApi.generate(
        groupId,
        {
          chatId,
          message: input.trim() || undefined,
          provider: connection.provider,
          model: connection.model,
          temperature: connection.temperature,
          maxTokens: connection.maxTokens,
          topP: connection.topP,
          topK: connection.topK,
          frequencyPenalty: connection.frequencyPenalty,
          presencePenalty: connection.presencePenalty,
          userName: "User",
          characterId: manualCharId,
        },
        controller.signal,
      )) {
        if (chunk.error) break;
        if (chunk.speaker) {
          setCurrentSpeaker(chunk.speaker);
        }
      }
      setInput("");
      onNewMessage();
    } catch {
      // Aborted or error
    } finally {
      setIsGenerating(false);
      setCurrentSpeaker(null);
      abortRef.current = null;
    }
  }, [groupId, chatId, input, connection, manualCharId, onNewMessage]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col gap-2">
      {isManualMode && <MemberSelector groupId={groupId} onSelect={(id) => setManualCharId(id)} />}

      {isGenerating && currentSpeaker && (
        <div className="text-xs text-muted-foreground">
          {currentSpeaker} {t("group.typing")}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("group.typeMessage")}
          className="h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          disabled={isGenerating}
        />
        {isGenerating ? (
          <Button size="sm" variant="destructive" onClick={handleStop}>
            {t("actions.stop")}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              void handleGenerate();
            }}
          >
            {t("actions.send")}
          </Button>
        )}
      </div>
    </div>
  );
}
