import { Injectable } from '@nestjs/common';
import type { WorldInfoVectorService, WIEmbeddingSettings } from './world-info-vector.service';
import type { WorldInfoEntryRow } from './world-info.service';

/** Select logic enum matching SillyTavern */
export enum SelectLogic {
  AND_ANY = 0,
  NOT_ALL = 1,
  NOT_ANY = 2,
  AND_ALL = 3,
}

/** Position enum */
export enum WIPosition {
  BEFORE_CHAR = 'before_char',
  AFTER_CHAR = 'after_char',
  BEFORE_EXAMPLE = 'before_example',
  AFTER_EXAMPLE = 'after_example',
  AT_DEPTH = 'at_depth',
  BEFORE_AUTHOR_NOTE = 'before_an',
  AFTER_AUTHOR_NOTE = 'after_an',
}

/** Role mapping */
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
  /** Keyword path: non-vectorized always; vectorized only when hybrid or constant. */
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
    const scanDepth = settings.scanDepth ?? 50;
    const maxRecursion = settings.maxRecursionSteps ?? 3;
    const enableRecursion = settings.recursion ?? true;
    const hybrid = wiEmbedding?.hybridMode ?? false;

    // Build scan buffer
    const recentMessages = context.chatMessages.slice(-scanDepth);
    let scanBuffer = recentMessages.join('\n');
    if (context.characterDescription) scanBuffer += '\n' + context.characterDescription;
    if (context.characterPersonality) scanBuffer += '\n' + context.characterPersonality;
    if (context.personaDescription) scanBuffer += '\n' + context.personaDescription;
    if (context.scenario) scanBuffer += '\n' + context.scenario;

    const enabledEntries = entries.filter((e) => e.enabled);
    const activatedIds = new Set<number>();
    const activated: ActivatedEntry[] = [];

    const keywordEntries = enabledEntries.filter((e) => this.isKeywordScannedEntry(e, hybrid));

    // Initial keyword scan
    this.scanRound(keywordEntries, scanBuffer, activatedIds, activated);

    // Vector scan (single embed over scan buffer, before recursion)
    const vectorEntries = enabledEntries.filter((e) => e.vectorized);
    if (vectorEntries.length > 0 && vectorService && wiEmbedding) {
      try {
        await this.scanVectorized(
          vectorEntries,
          entries,
          scanBuffer,
          activatedIds,
          activated,
          vectorService,
          wiEmbedding,
        );
      } catch {
        // Vector search failed — fall back to keyword matching for vectorized entries
        this.scanRound(vectorEntries, scanBuffer, activatedIds, activated);
      }
    }

    // Recursive keyword scans
    if (enableRecursion) {
      for (let step = 0; step < maxRecursion; step++) {
        const newEntries = enabledEntries.filter(
          (e) =>
            !activatedIds.has(e.id) &&
            !e.exclude_recursion &&
            this.isKeywordScannedEntry(e, hybrid),
        );
        if (newEntries.length === 0) break;

        const recursionBuffer = activated
          .filter((a) => !entries.find((e) => e.id === a.id)?.prevent_recursion)
          .map((a) => a.content)
          .join('\n');

        if (!recursionBuffer.trim()) break;

        const beforeCount = activated.length;
        this.scanRound(newEntries, scanBuffer + '\n' + recursionBuffer, activatedIds, activated);
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
    const bookIds = [...new Set(vectorEntries.map((e) => e.book_id))];
    const query = scanBuffer.slice(0, 4000);
    const hits = await vectorService.searchEntries(
      query,
      bookIds,
      wiEmbedding,
      vectorEntries.length,
    );
    const byId = new Map(allEntries.map((e) => [e.id, e]));
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
    buffer: string,
    activatedIds: Set<number>,
    activated: ActivatedEntry[],
  ): void {
    for (const entry of entries) {
      if (activatedIds.has(entry.id)) continue;

      if (this.shouldActivate(entry, buffer)) {
        activatedIds.add(entry.id);
        activated.push({
          id: entry.id,
          uid: entry.uid,
          content: entry.content,
          position: entry.position,
          order: entry.insertion_order,
          depth: entry.depth,
          role: entry.role,
          groupName: entry.group_name ?? '',
          groupWeight: entry.group_weight ?? 100,
        });
      }
    }
  }

  private shouldActivate(entry: WorldInfoEntryRow, buffer: string): boolean {
    // Constant entries always activate
    if (entry.constant) return true;

    // Probability check
    if (entry.use_probability && entry.probability < 100) {
      if (Math.random() * 100 >= entry.probability) return false;
    }

    const primaryKeys = this.parseKeys(entry.keys);
    if (primaryKeys.length === 0) return false;

    const caseSensitive = Boolean(entry.case_sensitive);
    const matchWholeWords = Boolean(entry.match_whole_words);
    const searchBuffer = caseSensitive ? buffer : buffer.toLowerCase();

    const primaryMatch = this.matchKeys(primaryKeys, searchBuffer, caseSensitive, matchWholeWords);
    if (!primaryMatch) return false;

    // If selective, check secondary keys
    if (entry.selective) {
      const secondaryKeys = this.parseKeys(entry.secondary_keys);
      if (secondaryKeys.length === 0) return true;

      const secondaryMatch = this.matchKeys(
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
            !this.matchAllKeys(secondaryKeys, searchBuffer, caseSensitive, matchWholeWords)
          );
        case SelectLogic.NOT_ANY:
          return primaryMatch && !secondaryMatch;
        case SelectLogic.AND_ALL:
          return (
            primaryMatch &&
            this.matchAllKeys(secondaryKeys, searchBuffer, caseSensitive, matchWholeWords)
          );
        default:
          return primaryMatch && secondaryMatch;
      }
    }

    return true;
  }

  private parseKeys(keysJson: string): string[] {
    try {
      const parsed = JSON.parse(keysJson);
      if (Array.isArray(parsed)) {
        return parsed.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
      }
      return [];
    } catch {
      // Try comma-separated fallback
      return keysJson
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    }
  }

  private matchKeys(
    keys: string[],
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    return keys.some((key) => this.matchSingleKey(key, buffer, caseSensitive, wholeWords));
  }

  private matchAllKeys(
    keys: string[],
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    return keys.every((key) => this.matchSingleKey(key, buffer, caseSensitive, wholeWords));
  }

  private matchSingleKey(
    key: string,
    buffer: string,
    caseSensitive: boolean,
    wholeWords: boolean,
  ): boolean {
    const searchKey = caseSensitive ? key : key.toLowerCase();

    if (wholeWords) {
      const escaped = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i');
      return regex.test(buffer);
    }

    return buffer.includes(searchKey);
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
      const entryData = group.map((g) => ({
        entry: g,
        source: allEntries.find((e) => e.id === g.id),
      }));

      const useGroupScoring = entryData.some((e) => e.source?.use_group_scoring);

      if (useGroupScoring) {
        // Weighted random selection
        const totalWeight = group.reduce((sum, g) => sum + g.groupWeight, 0);
        if (totalWeight > 0) {
          let roll = Math.random() * totalWeight;
          for (const entry of group) {
            roll -= entry.groupWeight;
            if (roll <= 0) {
              result.push(entry);
              break;
            }
          }
        }
      } else {
        // Include all group entries
        result.push(...group);
      }
    }

    return result;
  }
}
