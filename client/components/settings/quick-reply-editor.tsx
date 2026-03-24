"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuickReplyStore, type QuickReply } from "@/stores/quick-reply-store";

export function QuickReplyEditor() {
  const { sets, loaded, loadSets, addSet, removeSet, addQr, removeQr, updateQr } =
    useQuickReplyStore();
  const [newSetName, setNewSetName] = useState("");
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const [editingQr, setEditingQr] = useState<{ setName: string; qr: Partial<QuickReply> } | null>(
    null,
  );

  useEffect(() => {
    if (!loaded) void loadSets();
  }, [loaded, loadSets]);

  const handleAddSet = () => {
    const name = newSetName.trim();
    if (!name) return;
    addSet(name);
    setNewSetName("");
  };

  const handleAddQr = (setName: string) => {
    setEditingQr({
      setName,
      qr: {
        label: "",
        message: "",
        isHidden: false,
        executeOnStartup: false,
        executeOnUser: false,
        executeOnAi: false,
        executeOnChatChange: false,
        executeOnNewChat: false,
        executeBeforeGeneration: false,
      },
    });
  };

  const handleSaveQr = () => {
    if (!editingQr || !editingQr.qr.label || !editingQr.qr.message) return;
    if (editingQr.qr.id) {
      updateQr(editingQr.setName, editingQr.qr.id, editingQr.qr);
    } else {
      addQr(editingQr.setName, editingQr.qr as Omit<QuickReply, "id">);
    }
    setEditingQr(null);
  };

  const triggerFields = [
    { key: "executeOnStartup", label: "On Startup" },
    { key: "executeOnUser", label: "After User Message" },
    { key: "executeOnAi", label: "After AI Reply" },
    { key: "executeOnChatChange", label: "On Chat Change" },
    { key: "executeOnNewChat", label: "On New Chat" },
    { key: "executeBeforeGeneration", label: "Before Generation" },
  ] as const;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Quick Replies</h3>

      {/* Add Set */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSetName}
          onChange={(e) => setNewSetName(e.target.value)}
          placeholder="New set name..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAddSet()}
        />
        <Button size="sm" onClick={handleAddSet}>
          Add Set
        </Button>
      </div>

      {/* Sets list */}
      {sets.map((s) => (
        <div key={s.name} className="rounded-lg border border-border">
          <div
            className="flex cursor-pointer items-center justify-between px-3 py-2"
            onClick={() => setExpandedSet(expandedSet === s.name ? null : s.name)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">({s.qrList.length} items)</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddQr(s.name);
                }}
              >
                + Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSet(s.name);
                }}
              >
                Delete
              </Button>
            </div>
          </div>

          {expandedSet === s.name && (
            <div className="border-t border-border px-3 py-2 space-y-2">
              {s.qrList.map((qr) => (
                <div
                  key={qr.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5"
                >
                  <div>
                    <span className="text-sm font-medium">{qr.label}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {qr.message.slice(0, 50)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setEditingQr({ setName: s.name, qr: { ...qr } })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive"
                      onClick={() => removeQr(s.name, qr.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
              {s.qrList.length === 0 && (
                <p className="text-xs text-muted-foreground">No quick replies yet.</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* QR Editor Modal */}
      {editingQr && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-medium">{editingQr.qr.id ? "Edit" : "New"} Quick Reply</h4>

          <div className="space-y-2">
            <input
              type="text"
              value={editingQr.qr.label ?? ""}
              onChange={(e) =>
                setEditingQr({
                  ...editingQr,
                  qr: { ...editingQr.qr, label: e.target.value },
                })
              }
              placeholder="Button label"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
            <textarea
              value={editingQr.qr.message ?? ""}
              onChange={(e) =>
                setEditingQr({
                  ...editingQr,
                  qr: { ...editingQr.qr, message: e.target.value },
                })
              }
              placeholder="Slash command script (e.g. /setvar key=mood happy | /gen)"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Auto-execute triggers</p>
            {triggerFields.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <Switch
                  checked={Boolean(editingQr.qr[key])}
                  onCheckedChange={(checked) =>
                    setEditingQr({
                      ...editingQr,
                      qr: { ...editingQr.qr, [key]: checked },
                    })
                  }
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveQr}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingQr(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
