import { Injectable } from '@nestjs/common';
import type { WorldInfoVectorService, WIEmbeddingSettings } from './world-info-vector.service';
import type { WorldInfoEntryRow } from './world-info.service';

export enum SelectLogic {
  AND_ANY = 0,
  NOT_ALL = 1,
  NOT_ANY = 2,
  AND_ALL = 3,
}

export enum WIPosition {
  BEFORE_CHAR = 'before_char',
  AFTER_CHAR = 'after_char',
  BEFORE_EXAMPLE = 'before_example',
  AFTER_EXAMPLE = 'after_example',
  AT_DEPTH = 'at_depth',
  BEFORE_AUTHOR_NOTE = 'before_an',
  AFTER_AUTHOR_NOTE = 'after_an',
}

export enum WIRole {
  SYSTEM = 0,
  USER = 1,
  ASSISTANT = 2,
}

export interface ActivatedEntry {
  id: number;
  uid: number;
  content: string;
  position: string;
  order: number;
  depth: number;
  role: number;
  groupName: string;
  groupWeight: number;
}

export interface ScanContext {
  chatMessages: string[];
  characterDescription?: string;
  characterPersonality?: string;
  personaDescription?: string;
  scenario?: string;
}

export interface ScanSettings {
  scanDepth?: number;
  recursion?: boolean;
  maxRecursionSteps?: number;
  caseSensitive?: boolean;
}

@Injectable()
export class WorldInfoScannerService {
  private isKeywordScannedEntry(entry: WorldInfoEntryRow, hybrid: boolean): boolean {
    if (entry.constant) return true;
    if (!entry.vectorized) return true;
    return hybrid;
  }

  private entryToActivated(entry: WorldInfoEntryRow): ActivatedEntry {
    return {
      id: entry.id,
      uid: entry.uid,
      content: entry.content,
      position: entry.position,
      order: entry.insertion_order,
      depth: entry.depth,
      role: entry.role,
      groupName: entry.group_name ?? '',
      groupWeight: entry.group_weight ?? 100,
    };
  }

  private passesProbability(entry: WorldInfoEntryRow): boolean {
    if (entry.constant) return true;
    if (entry.use_probability && entry.probability < 100) {
      return Math.random() * 100 < entry.probability;
    }
    return true;
  }

  async scan(
    entries: WorldInfoEntryRow[],
    context: ScanContext,
    settings: ScanSettings = {},
    vectorService?: WorldInfoVectorService,
    wiEmbedding?: WIEmbeddingSettings,
  ): Promise<ActivatedEntry[]> {
    const maxRecursion = settings.maxRecursionSteps ?? 3;
    const enableRecursion = settings.recursion ?? true;
    const hybrid = wiEmbedding?.hybridMode ?? false;

    const enabledEntries = entries.filter((entry) => entry.enabled);
    const activatedIds = new Set<number>();
    const activated: ActivatedEntry[] = [];

    const keywordEntries = enabledEntries.filter((entry) =>
      this.isKeywordScannedEntry(entry, hybrid),
    );
    this.scanRound(keywordEntries, context, settings, activatedIds, activated);

    const vectorEntries = enabledEntries.filter((entry) => entry.vectorized);
    if (vectorEntries.length > 0 && vectorService && wiEmbedding) {
      const vectorBuffer = this.buildScanBuffer(
        undefined,
        context,
        settings.scanDepth ?? 50,
        false,
      );

      try {
        await this.scanVectorized(
          vectorEntries,
          entries,
          vectorBuffer,
          activatedIds,
          activated,
          vectorService,
          wiEmbedding,
        );
      } catch {
        this.scanRound(vectorEntries, context, settings, activatedIds, activated);
      }
    }

    if (enableRecursion) {
      for (let step = 0; step < maxRecursion; step += 1) {
        const newEntries = enabledEntries.filter(
          (entry) =>
            !activatedIds.has(entry.id) &&
            !entry.exclude_recursion &&
            this.isKeywordScannedEntry(entry, hybrid),
        );
        if (newEntries.length === 0) break;

        const recursionBuffer = activated
          .filter((item) => !entries.find((entry) => entry.id === item.id)?.prevent_recursion)
          .map((item) => item.content)
          .join('\n');
        if (!recursionBuffer.trim()) break;

        const beforeCount = activated.length;
        this.scanRound(
          newEntries,
          {
            ...context,
            chatMessages: [...context.chatMessages, recursionBuffer],
          },
          settings,
          activatedIds,
          activated,
        );
        if (activated.length === beforeCount) break;
      }
    }

    const grouped = this.applyGroupScoring(activated, entries);
    grouped.sort((a, b) => a.order - b.order);
    return grouped;
  }

  private async scanVectorized(
    vectorEntries: WorldInfoEntryRow[],
    allEntries: WorldInfoEntryRow[],
    scanBuffer: string,
    activatedIds: Set<number>,
    activated: ActivatedEntry[],
    vectorService: WorldInfoVectorService,
    wiEmbedding: WIEmbeddingSettings,
  ): Promise<void> {
    const bookIds = [...new Set(vectorEntries.map((entry) => entry.book_id))];
    const query = scanBuffer.slice(0, 4000);
    const hits = await vectorService.searchEntries(
      query,
      bookIds,
      wiEmbedding,
      vectorEntries.length,
    );
    const byId = new Map(allEntries.map((entry) => [entry.id, entry]));

    for (const hit of hits) {
      if (activatedIds.has(hit.entryId)) continue;
      const entry = byId.get(hit.entryId);
      if (!entry || !entry.enabled || !entry.vectorized) continue;
      if (!this.passesProbability(entry)) continue;
      activatedIds.add(entry.id);
      activated.push(this.entryToActivated(entry));
    }
  }

  private scanRound(
    entries: WorldInfoEntryRow[],
    context: ScanContext,
    settings: ScanSettings,
    activatedIds: Set<number>,
    activated: ActivatedEntry[],
  ): void {
    for (const entry of entries) {
      if (activatedIds.has(entry.id)) continue;
      if (!this.shouldActivate(entry, context, settings)) continue;

      activatedIds.add(entry.id);
      activated.push(this.entryToActivated(entry));
    }
  }

  private shouldActivate(
    entry: WorldInfoEntryRow,
    context: ScanContext,
    settings: ScanSettings,
  ): boolean {
    if (entry.constant) return true;

    if (entry.use_probability && entry.probability < 100) {
      if (Math.random() * 100 >= entry.probability) return false;
    }

    const primaryKeys = this.parseKeys(entry.keys);
    if (primaryKeys.length === 0) return false;

    const caseSensitive = Boolean(entry.case_sensitive || settings.caseSensitive);
    const matchWholeWords = Boolean(entry.match_whole_words);
    const buffer = this.buildScanBuffer(entry, context, settings.scanDepth ?? 50);
    const searchBuffer = caseSensitive ? buffer : buffer.toLowerCase();

    const primaryMatch = this.matchKeys(
      entry,
      primaryKeys,
      searchBuffer,
      caseSensitive,
      matchWholeWords,
    );
    if (!primaryMatch) return false;

    if (!entry.selective) return true;

    const secondaryKeys = this.parseKeys(entry.secondary_keys);
    if (secondaryKeys.length === 0) return true;

    const secondaryMatch = this.matchKeys(
      entry,
      secondaryKeys,
      searchBuffer,
      caseSensitive,
      matchWholeWords,
    );
    const logic = entry.select_logic ?? SelectLogic.AND_ANY;

    switch (logic) {
      case SelectLogic.AND_ANY:
        return primaryMatch && secondaryMatch;
      case SelectLogic.NOT_ALL:
        return (
          primaryMatch &&
          !this.matchAllKeys(entry, secondaryKeys, searchBuffer, caseSensitive, matchWholeWords)
        );
      case SelectLogic.NOT_ANY:
        return primaryMatch && !secondaryMatch;
      case SelectLogic.AND_ALL:
        return (
          primaryMatch &&
          this.matchAllKeys(entry, secondaryKeys, searchBuffer, caseSensitive, matchWholeWords)
        );
      default:
        return primaryMatch && secondaryMatch;
    }
  }

  private buildScanBuffer(
    entry: WorldInfoEntryRow | undefined,
    context: ScanContext,
    defaultScanDepth: number,
    includeOptionalContext = true,
  ): string {
    const scanDepth = entry && entry.scan_depth > 0 ? entry.scan_depth : defaultScanDepth;
    const parts = context.chatMessages.slice(-scanDepth);

    if (includeOptionalContext && entry) {
      if (entry.match_char_desc && context.characterDescription) {
        parts.push(context.characterDescription);
      }
      if (entry.match_char_personality && context.characterPersonality) {
        parts.push(context.characterPersonality);
      }
      if (entry.match_persona_desc && context.personaDescription) {
        parts.push(context.personaDescription);
      }
      if (entry.match_scenario && context.scenario) {
        parts.push(context.scenario);
      }
    }

    return parts.filter(Boolean).join('\n');
  }

  private parseKeys(keysJson: string): string[] {
    try {
      const parsed = JSON.parse(keysJson);
      if (Array.isArray(parsed)) {
        return parsed.map((key: string) => key.trim()).filter((key: string) => key.length > 0);
      }
      return [];
    } catch {
      return keysJson
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
    }
  }

  private matchKeys(
    entry: WorldInfoEntryRow,
    keys: string[],
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    return keys.some((key) => this.matchSingleKey(entry, key, buffer, caseSensitive, wholeWords));
  }

  private matchAllKeys(
    entry: WorldInfoEntryRow,
    keys: string[],
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    return keys.every((key) => this.matchSingleKey(entry, key, buffer, caseSensitive, wholeWords));
  }

  private matchSingleKey(
    entry: WorldInfoEntryRow,
    key: string,
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    const searchKey = caseSensitive ? key : key.toLowerCase();
    const shouldUseRegex = Boolean(entry.use_regex) || this.isRegexPattern(searchKey);

    if (shouldUseRegex) {
      const regex = this.regexFromKey(key, caseSensitive);
      return regex ? regex.test(buffer) : false;
    }

    if (wholeWords) {
      const escaped = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i');
      return regex.test(buffer);
    }

    return buffer.includes(searchKey);
  }

  private isRegexPattern(key: string): boolean {
    return /^\/.+\/[gimsuy]*$/.test(key.trim());
  }

  private regexFromKey(key: string, caseSensitive: boolean): RegExp | null {
    const trimmed = key.trim();
    const slashMatch = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);

    try {
      if (slashMatch) {
        const [, pattern, rawFlags] = slashMatch;
        const flags = caseSensitive
          ? rawFlags.replace(/i/g, '')
          : rawFlags.includes('i')
            ? rawFlags
            : `${rawFlags}i`;
        return new RegExp(pattern, flags);
      }

      return new RegExp(trimmed, caseSensitive ? '' : 'i');
    } catch {
      return null;
    }
  }

  private applyGroupScoring(
    activated: ActivatedEntry[],
    allEntries: WorldInfoEntryRow[],
  ): ActivatedEntry[] {
    const groupMap = new Map<string, ActivatedEntry[]>();
    const ungrouped: ActivatedEntry[] = [];

    for (const entry of activated) {
      if (entry.groupName) {
        const group = groupMap.get(entry.groupName) || [];
        group.push(entry);
        groupMap.set(entry.groupName, group);
      } else {
        ungrouped.push(entry);
      }
    }

    const result: ActivatedEntry[] = [...ungrouped];

    for (const [, group] of groupMap) {
      const entryData = group.map((item) => ({
        entry: item,
        source: allEntries.find((entry) => entry.id === item.id),
      }));

      const useGroupScoring = entryData.some((item) => item.source?.use_group_scoring);
      if (useGroupScoring) {
        const totalWeight = group.reduce((sum, item) => sum + item.groupWeight, 0);
        if (totalWeight > 0) {
          let roll = Math.random() * totalWeight;
          for (const item of group) {
            roll -= item.groupWeight;
            if (roll <= 0) {
              result.push(item);
              break;
            }
          }
        }
        continue;
      }

      result.push(...group);
    }

    return result;
  }
}
