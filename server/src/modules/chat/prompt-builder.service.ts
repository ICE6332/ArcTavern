import { Injectable } from '@nestjs/common';
import type { CharacterRow } from '../character/character.service';
import type { ChatRow, MessageRow } from './chat.service';
import type { ChatMessage } from '../ai-provider/types';
import type { ActivatedEntry } from '../world-info/world-info-scanner.service';
import type { RetrievedMemory } from '../rag/types';

interface PromptBuildSettings {
  maxTokens?: number;
  maxContext?: number;
  userName?: string;
  mergeSystemMessages?: boolean;
  personaDescription?: string;
  worldInfoSettings?: {
    activatedEntries?: ActivatedEntry[];
  };
  ragContext?: RetrievedMemory[];
  ragMaxTokenBudget?: number;
  ragInsertionPosition?: 'before_char' | 'after_char' | 'at_depth';
  ragInsertionDepth?: number;
  promptOrder?: Array<{ identifier: string; enabled: boolean }>;
  customPrompts?: Array<{ identifier: string; role: string; content: string }>;
}

interface PromptBuildContext {
  character: CharacterRow;
  persona?: string;
  worldInfoBefore: string[];
  worldInfoAfter: string[];
  examples: string;
  ragBlock: string | null;
  customPrompts: Map<string, { role: string; content: string }>;
}

@Injectable()
export class PromptBuilderService {
  buildPrompt(
    character: CharacterRow,
    _chat: ChatRow,
    messages: MessageRow[],
    settings: PromptBuildSettings,
    worldInfo?: { before?: string; after?: string },
  ): ChatMessage[] {
    const maxTokens = settings.maxTokens ?? 1024;
    const maxContext = settings.maxContext ?? 16384;
    const tokenBudget = Math.max(512, maxContext - maxTokens);

    const systemMessages = this.buildSystemMessages(character, settings, worldInfo);

    const history = messages
      .filter((m) => !m.is_hidden)
      .map((m) => ({
        role: this.normalizeRole(m.role),
        content: this.applyMacros(m.content, character.name, settings.userName),
        ...(m.name ? { name: m.name } : {}),
      })) as ChatMessage[];

    const prompt = [...systemMessages, ...this.trimHistory(systemMessages, history, tokenBudget)];

    // Insert depth-based world info entries into the prompt
    const depthEntries = settings.worldInfoSettings?.activatedEntries?.filter(
      (e) => e.position === 'at_depth',
    );
    if (depthEntries && depthEntries.length > 0) {
      this.insertDepthEntries(prompt, depthEntries);
    }

    // Insert RAG context at depth if configured
    if (settings.ragInsertionPosition === 'at_depth' && settings.ragContext?.length) {
      const ragBlock = this.buildRagBlock(settings.ragContext, settings.ragMaxTokenBudget);
      if (ragBlock) {
        const depth = settings.ragInsertionDepth ?? 4;
        const insertIndex = Math.max(0, prompt.length - depth);
        prompt.splice(insertIndex, 0, { role: 'system' as const, content: ragBlock });
      }
    }

    if (settings.mergeSystemMessages) {
      const merged: ChatMessage[] = [];
      const systemBuffer: string[] = [];
      for (const message of prompt) {
        if (message.role === 'system') {
          if (typeof message.content === 'string') systemBuffer.push(message.content);
          continue;
        }
        if (systemBuffer.length > 0) {
          merged.push({ role: 'system', content: systemBuffer.join('\n\n') });
          systemBuffer.length = 0;
        }
        merged.push(message);
      }
      if (systemBuffer.length > 0) {
        merged.unshift({ role: 'system', content: systemBuffer.join('\n\n') });
      }
      return merged;
    }

    return prompt;
  }

  private buildSystemMessages(
    character: CharacterRow,
    settings: PromptBuildSettings,
    worldInfo?: { before?: string; after?: string },
  ): ChatMessage[] {
    // If custom promptOrder is provided, use order-aware assembly
    if (settings.promptOrder && settings.promptOrder.length > 0) {
      return this.buildSystemMessagesOrdered(character, settings, worldInfo);
    }

    // Legacy hardcoded order (backward compatible)
    return this.buildSystemMessagesLegacy(character, settings, worldInfo);
  }

  /**
   * Order-aware prompt assembly: iterate promptOrder in sequence,
   * resolve each identifier to its content, skip disabled items.
   */
  private buildSystemMessagesOrdered(
    character: CharacterRow,
    settings: PromptBuildSettings,
    worldInfo?: { before?: string; after?: string },
  ): ChatMessage[] {
    const activatedEntries = settings.worldInfoSettings?.activatedEntries ?? [];

    const context: PromptBuildContext = {
      character,
      persona: settings.personaDescription,
      worldInfoBefore: [
        ...activatedEntries.filter((e) => e.position === 'before_char').map((e) => e.content),
        ...(worldInfo?.before ? [worldInfo.before] : []),
      ],
      worldInfoAfter: [
        ...activatedEntries.filter((e) => e.position === 'after_char').map((e) => e.content),
        ...(worldInfo?.after ? [worldInfo.after] : []),
      ],
      examples: character.mes_example ?? '',
      ragBlock:
        settings.ragInsertionPosition !== 'at_depth'
          ? this.buildRagBlock(settings.ragContext, settings.ragMaxTokenBudget)
          : null,
      customPrompts: new Map(
        (settings.customPrompts ?? []).map((p) => [
          p.identifier,
          { role: p.role, content: p.content },
        ]),
      ),
    };

    const messages: ChatMessage[] = [];

    for (const item of settings.promptOrder!) {
      if (!item.enabled) continue;
      if (item.identifier === 'chatHistory') continue; // handled by caller

      const resolved = this.resolveIdentifier(item.identifier, context);
      if (resolved && resolved.content.trim()) {
        messages.push({
          role: resolved.role as ChatMessage['role'],
          content: this.applyMacros(resolved.content, character.name, settings.userName),
        });
      }
    }

    return messages;
  }

  /**
   * Map an identifier to its content based on the prompt build context.
   */
  private resolveIdentifier(
    identifier: string,
    context: PromptBuildContext,
  ): { role: string; content: string } | null {
    // Check custom prompts first (user-edited content overrides defaults)
    const custom = context.customPrompts.get(identifier);

    switch (identifier) {
      case 'main':
        return {
          role: 'system',
          content: custom?.content ?? context.character.system_prompt ?? '',
        };
      case 'charDescription':
        return {
          role: 'system',
          content: context.character.description
            ? `Character Description:\n${context.character.description}`
            : '',
        };
      case 'charPersonality':
        return {
          role: 'system',
          content: context.character.personality
            ? `Character Personality:\n${context.character.personality}`
            : '',
        };
      case 'scenario':
        return {
          role: 'system',
          content: context.character.scenario
            ? `Scenario:\n${context.character.scenario}`
            : '',
        };
      case 'personaDescription':
        return {
          role: 'system',
          content: context.persona
            ? `User Persona:\n${context.persona}`
            : '',
        };
      case 'worldInfoBefore':
        return {
          role: 'system',
          content: context.worldInfoBefore.join('\n'),
        };
      case 'worldInfoAfter':
        return {
          role: 'system',
          content: context.worldInfoAfter.join('\n'),
        };
      case 'dialogueExamples':
        return {
          role: 'system',
          content: context.examples
            ? `Example Messages:\n${context.examples}`
            : '',
        };
      case 'jailbreak':
        return {
          role: 'system',
          content: custom?.content
            ?? (context.character.post_history_instructions
              ? `Post-History Instructions:\n${context.character.post_history_instructions}`
              : ''),
        };
      default:
        // Any custom/user-defined prompt component
        if (custom) return { role: custom.role, content: custom.content };
        return null;
    }
  }

  /**
   * Legacy hardcoded prompt assembly — used when no promptOrder is provided.
   */
  private buildSystemMessagesLegacy(
    character: CharacterRow,
    settings: PromptBuildSettings,
    worldInfo?: { before?: string; after?: string },
  ): ChatMessage[] {
    const activatedEntries = settings.worldInfoSettings?.activatedEntries ?? [];

    // Collect positioned entries
    const beforeCharEntries = activatedEntries
      .filter((e) => e.position === 'before_char')
      .map((e) => e.content);
    const afterCharEntries = activatedEntries
      .filter((e) => e.position === 'after_char')
      .map((e) => e.content);
    const beforeExampleEntries = activatedEntries
      .filter((e) => e.position === 'before_example')
      .map((e) => e.content);
    const afterExampleEntries = activatedEntries
      .filter((e) => e.position === 'after_example')
      .map((e) => e.content);
    const beforeAnEntries = activatedEntries
      .filter((e) => e.position === 'before_an')
      .map((e) => e.content);
    const afterAnEntries = activatedEntries
      .filter((e) => e.position === 'after_an')
      .map((e) => e.content);

    // Build RAG memory block (for non-depth positions)
    const ragBlock = (settings.ragInsertionPosition !== 'at_depth')
      ? this.buildRagBlock(settings.ragContext, settings.ragMaxTokenBudget)
      : null;

    const sections: Array<string | null> = [
      character.system_prompt || null,

      // Persona description
      settings.personaDescription
        ? `User Persona:\n${settings.personaDescription}`
        : null,

      // Before char WI entries
      beforeCharEntries.length > 0 ? beforeCharEntries.join('\n') : null,

      // Legacy WI before
      worldInfo?.before ? `World Info (Before):\n${worldInfo.before}` : null,

      // RAG: before character description
      settings.ragInsertionPosition === 'before_char' ? ragBlock : null,

      character.description ? `Character Description:\n${character.description}` : null,
      character.personality ? `Character Personality:\n${character.personality}` : null,
      character.scenario ? `Scenario:\n${character.scenario}` : null,

      // After char WI entries
      afterCharEntries.length > 0 ? afterCharEntries.join('\n') : null,

      // RAG: after character description (default)
      (settings.ragInsertionPosition === 'after_char' || !settings.ragInsertionPosition) ? ragBlock : null,

      // Before example entries
      beforeExampleEntries.length > 0 ? beforeExampleEntries.join('\n') : null,

      character.mes_example ? `Example Messages:\n${character.mes_example}` : null,

      // After example entries
      afterExampleEntries.length > 0 ? afterExampleEntries.join('\n') : null,

      // Legacy WI after
      worldInfo?.after ? `World Info (After):\n${worldInfo.after}` : null,

      // Before author note entries
      beforeAnEntries.length > 0 ? beforeAnEntries.join('\n') : null,

      character.post_history_instructions
        ? `Post-History Instructions:\n${character.post_history_instructions}`
        : null,

      // After author note entries
      afterAnEntries.length > 0 ? afterAnEntries.join('\n') : null,
    ];

    return sections
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => ({
        role: 'system' as const,
        content: this.applyMacros(value, character.name, settings.userName),
      }));
  }

  private insertDepthEntries(prompt: ChatMessage[], entries: ActivatedEntry[]): void {
    for (const entry of entries) {
      const depth = entry.depth ?? 4;
      const role = entry.role === 1 ? 'user' : entry.role === 2 ? 'assistant' : 'system';

      // Insert at specified depth from the end of the prompt
      const insertIndex = Math.max(0, prompt.length - depth);
      prompt.splice(insertIndex, 0, {
        role: role as ChatMessage['role'],
        content: entry.content,
      });
    }
  }

  private trimHistory(
    systemMessages: ChatMessage[],
    history: ChatMessage[],
    tokenBudget: number,
  ): ChatMessage[] {
    if (history.length === 0) return [];

    const systemCost = this.estimateTokens(systemMessages);
    let remaining = Math.max(0, tokenBudget - systemCost);
    const kept: ChatMessage[] = [];

    for (let i = history.length - 1; i >= 0; i -= 1) {
      const message = history[i];
      const messageCost = this.estimateTokens([message]);
      if (messageCost > remaining && kept.length > 0) {
        break;
      }
      if (messageCost <= remaining || kept.length === 0) {
        kept.unshift(message);
        remaining -= messageCost;
      }
    }

    return kept;
  }

  private estimateTokens(messages: ChatMessage[]): number {
    const chars = messages.reduce((sum, message) => {
      const content =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content ?? '');
      return sum + content.length + (message.name?.length ?? 0) + 8;
    }, 0);
    return Math.max(1, Math.ceil(chars / 4));
  }

  private applyMacros(value: string, charName: string, userName = 'User'): string {
    const now = new Date();
    return value
      .replaceAll('{{char}}', charName)
      .replaceAll('{{user}}', userName)
      .replaceAll('{{date}}', now.toLocaleDateString())
      .replaceAll('{{time}}', now.toLocaleTimeString())
      .replaceAll('{{random}}', Math.random().toString(36).slice(2, 8));
  }

  private normalizeRole(role: string): ChatMessage['role'] {
    if (role === 'assistant' || role === 'system' || role === 'tool') return role;
    return 'user';
  }

  private buildRagBlock(
    memories?: RetrievedMemory[],
    maxTokenBudget?: number,
  ): string | null {
    if (!memories || memories.length === 0) return null;

    const maxChars = (maxTokenBudget ?? 1024) * 4;
    let block = 'Relevant memories from past conversations:\n';
    let charCount = block.length;

    for (const mem of memories) {
      const label = mem.name || mem.role;
      const entry = `[${label}]: ${mem.content}\n`;
      if (charCount + entry.length > maxChars) break;
      block += entry;
      charCount += entry.length;
    }

    return block.trim();
  }
}
