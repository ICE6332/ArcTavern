"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useGroupStore } from "@/stores/group-store";

interface GroupListProps {
  onSelectGroup: (id: string) => void;
  onCreateGroup: () => void;
}

export function GroupList({ onSelectGroup, onCreateGroup }: GroupListProps) {
  const { t } = useTranslation();
  const { groups, selectedGroupId, fetchGroups, deleteGroup } = useGroupStore();

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("group.title")}</h3>
        <Button size="sm" variant="outline" onClick={onCreateGroup}>
          {t("actions.new")}
        </Button>
      </div>
      <div className="space-y-1">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
              selectedGroupId === group.id ? "bg-accent" : ""
            }`}
            onClick={() => onSelectGroup(group.id)}
          >
            <span className="truncate">{group.name}</span>
            <button
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteGroup(group.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("group.noGroups")}</p>
        )}
      </div>
    </div>
  );
}
