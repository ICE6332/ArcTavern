"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorldInfoStore } from "@/stores/world-info-store";
import type { WorldInfoEntry } from "@/lib/api/world-info";

interface EntryEditorProps {
  entry: WorldInfoEntry;
  onClose: () => void;
}

export function EntryEditor({ entry, onClose }: EntryEditorProps) {
  const { t } = useTranslation();
  const { updateEntry } = useWorldInfoStore();

  const [keys, setKeys] = useState(entry.keys.join(", "));
  const [secondaryKeys, setSecondaryKeys] = useState(entry.secondaryKeys.join(", "));
  const [content, setContent] = useState(entry.content);
  const [comment, setComment] = useState(entry.comment);
  const [enabled, setEnabled] = useState(entry.enabled);
  const [constant, setConstant] = useState(entry.constant);
  const [selective, setSelective] = useState(entry.selective);
  const [selectLogic, setSelectLogic] = useState(entry.selectLogic);
  const [position, setPosition] = useState(entry.position);
  const [insertionOrder, setInsertionOrder] = useState(entry.insertionOrder);
  const [priority, setPriority] = useState(entry.priority);
  const [depth, setDepth] = useState(entry.depth);
  const [probability, setProbability] = useState(entry.probability);
  const [role, setRole] = useState(entry.role);
  const [groupName, setGroupName] = useState(entry.groupName);
  const [sticky, setSticky] = useState(entry.sticky);
  const [cooldown, setCooldown] = useState(entry.cooldown);
  const [delay, setDelay] = useState(entry.delay);

  const handleSave = async () => {
    await updateEntry(entry.id, {
      keys: keys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      secondaryKeys: secondaryKeys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      content,
      comment,
      enabled,
      constant,
      selective,
      selectLogic,
      position,
      insertionOrder,
      priority,
      depth,
      probability,
      role,
      groupName,
      sticky,
      cooldown,
      delay,
    });
    onClose();
  };

  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
      <div className="space-y-1">
        <Label>{t("worldInfo.comment")}</Label>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label>{t("worldInfo.primaryKeysComma")}</Label>
        <Input value={keys} onChange={(e) => setKeys(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="space-y-1">
        <Label>{t("worldInfo.content")}</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{" "}
          {t("worldInfo.enabled")}
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={constant}
            onChange={(e) => setConstant(e.target.checked)}
          />{" "}
          {t("worldInfo.constant")}
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={selective}
            onChange={(e) => setSelective(e.target.checked)}
          />{" "}
          {t("worldInfo.selective")}
        </label>
      </div>

      {selective && (
        <>
          <div className="space-y-1">
            <Label>{t("worldInfo.secondaryKeys")}</Label>
            <Input
              value={secondaryKeys}
              onChange={(e) => setSecondaryKeys(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("worldInfo.selectLogic")}</Label>
            <Select value={String(selectLogic)} onValueChange={(v) => setSelectLogic(Number(v))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">AND ANY</SelectItem>
                <SelectItem value="1">NOT ALL</SelectItem>
                <SelectItem value="2">NOT ANY</SelectItem>
                <SelectItem value="3">AND ALL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>{t("worldInfo.position")}</Label>
          <Select value={position} onValueChange={(value) => setPosition(value ?? "before_char")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before_char">{t("worldInfo.posBefore")}</SelectItem>
              <SelectItem value="after_char">{t("worldInfo.posAfter")}</SelectItem>
              <SelectItem value="before_example">{t("worldInfo.posBeforeExample")}</SelectItem>
              <SelectItem value="after_example">{t("worldInfo.posAfterExample")}</SelectItem>
              <SelectItem value="at_depth">{t("worldInfo.posAtDepth")}</SelectItem>
              <SelectItem value="before_an">{t("worldInfo.posBeforeAN")}</SelectItem>
              <SelectItem value="after_an">{t("worldInfo.posAfterAN")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.role")}</Label>
          <Select value={String(role)} onValueChange={(v) => setRole(Number(v))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t("promptComponents.roles.system")}</SelectItem>
              <SelectItem value="1">{t("promptComponents.roles.user")}</SelectItem>
              <SelectItem value="2">{t("promptComponents.roles.assistant")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label>{t("worldInfo.order")}</Label>
          <Input
            type="number"
            value={insertionOrder}
            onChange={(e) => setInsertionOrder(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.priority")}</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.depth")}</Label>
          <Input
            type="number"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label>{t("worldInfo.probability")}</Label>
          <Input
            type="number"
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.sticky")}</Label>
          <Input
            type="number"
            value={sticky}
            onChange={(e) => setSticky(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.cooldown")}</Label>
          <Input
            type="number"
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>{t("worldInfo.delay")}</Label>
          <Input
            type="number"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>{t("worldInfo.groupName")}</Label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            void handleSave();
          }}
        >
          {t("actions.save")}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
      </div>
    </div>
  );
}
