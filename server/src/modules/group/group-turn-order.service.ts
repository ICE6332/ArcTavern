import { Injectable } from '@nestjs/common';
import type { CharacterRow } from '../character/character.service';
import type { MessageRow } from '../chat/chat.service';

export enum ActivationStrategy {
  NATURAL = 0,
  LIST = 1,
  MANUAL = 2,
  POOLED = 3,
}

export interface TurnOrderContext {
  members: Array<{ characterId: number; sortOrder: number }>;
  characters: CharacterRow[];
  recentMessages: MessageRow[];
  disabledMembers: number[];
  lastSpeakerId?: number;
}

@Injectable()
export class GroupTurnOrderService {
  selectNext(
    context: TurnOrderContext,
    strategy: ActivationStrategy,
  ): number | null {
    const enabledMembers = context.members.filter(
      (m) => !context.disabledMembers.includes(m.characterId),
    );

    if (enabledMembers.length === 0) return null;

    switch (strategy) {
      case ActivationStrategy.NATURAL:
        return this.selectNatural(enabledMembers, context);
      case ActivationStrategy.LIST:
        return this.selectList(enabledMembers, context);
      case ActivationStrategy.MANUAL:
        return null;
      case ActivationStrategy.POOLED:
        return this.selectPooled(enabledMembers);
      default:
        return this.selectList(enabledMembers, context);
    }
  }

  private selectNatural(
    members: Array<{ characterId: number; sortOrder: number }>,
    context: TurnOrderContext,
  ): number {
    // Analyze recent messages to pick contextually appropriate character
    const recentSpeakers = new Set<number>();
    for (const msg of context.recentMessages.slice(-5)) {
      if (msg.role === 'assistant' && msg.name) {
        const char = context.characters.find((c) => c.name === msg.name);
        if (char) recentSpeakers.add(char.id);
      }
    }

    // Prefer characters who haven't spoken recently
    const candidates = members.filter((m) => !recentSpeakers.has(m.characterId));
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)].characterId;
    }

    // If all have spoken, pick any except last speaker
    const othersExceptLast = members.filter(
      (m) => m.characterId !== context.lastSpeakerId,
    );
    if (othersExceptLast.length > 0) {
      return othersExceptLast[Math.floor(Math.random() * othersExceptLast.length)].characterId;
    }

    return members[0].characterId;
  }

  private selectList(
    members: Array<{ characterId: number; sortOrder: number }>,
    context: TurnOrderContext,
  ): number {
    // Round-robin by sort_order
    const sorted = [...members].sort((a, b) => a.sortOrder - b.sortOrder);

    if (!context.lastSpeakerId) return sorted[0].characterId;

    const lastIndex = sorted.findIndex((m) => m.characterId === context.lastSpeakerId);
    const nextIndex = (lastIndex + 1) % sorted.length;
    return sorted[nextIndex].characterId;
  }

  private selectPooled(
    members: Array<{ characterId: number; sortOrder: number }>,
  ): number {
    // Random selection
    return members[Math.floor(Math.random() * members.length)].characterId;
  }
}
