/// <reference types="vitest/globals" />
import { GroupTurnOrderService, ActivationStrategy } from './group-turn-order.service';
import type { CharacterRow } from '../character/character.service';
import type { MessageRow } from '../chat/chat.service';

function makeContext(overrides: Partial<Parameters<GroupTurnOrderService['selectNext']>[0]> = {}) {
  return {
    members: [
      { characterId: 1, sortOrder: 0 },
      { characterId: 2, sortOrder: 1 },
      { characterId: 3, sortOrder: 2 },
    ],
    characters: [
      { id: 1, name: 'Alice' } as CharacterRow,
      { id: 2, name: 'Bob' } as CharacterRow,
      { id: 3, name: 'Charlie' } as CharacterRow,
    ],
    recentMessages: [] as MessageRow[],
    disabledMembers: [],
    ...overrides,
  };
}

describe('GroupTurnOrderService', () => {
  const service = new GroupTurnOrderService();

  it('LIST: returns first member when no last speaker', () => {
    const result = service.selectNext(makeContext(), ActivationStrategy.LIST);
    expect(result).toBe(1);
  });

  it('LIST: round-robins to next member', () => {
    const result = service.selectNext(makeContext({ lastSpeakerId: 1 }), ActivationStrategy.LIST);
    expect(result).toBe(2);
  });

  it('LIST: wraps around to first member', () => {
    const result = service.selectNext(makeContext({ lastSpeakerId: 3 }), ActivationStrategy.LIST);
    expect(result).toBe(1);
  });

  it('MANUAL: returns null', () => {
    const result = service.selectNext(makeContext(), ActivationStrategy.MANUAL);
    expect(result).toBeNull();
  });

  it('POOLED: returns a valid member', () => {
    const result = service.selectNext(makeContext(), ActivationStrategy.POOLED);
    expect([1, 2, 3]).toContain(result);
  });

  it('returns null when no enabled members', () => {
    const result = service.selectNext(
      makeContext({ disabledMembers: [1, 2, 3] }),
      ActivationStrategy.LIST,
    );
    expect(result).toBeNull();
  });

  it('NATURAL: picks a member not recently spoken', () => {
    const result = service.selectNext(
      makeContext({
        recentMessages: [
          { role: 'assistant', name: 'Alice' } as MessageRow,
          { role: 'assistant', name: 'Bob' } as MessageRow,
        ],
      }),
      ActivationStrategy.NATURAL,
    );
    // Should prefer Charlie since Alice and Bob spoke recently
    expect(result).toBe(3);
  });

  it('LIST: skips disabled members', () => {
    const result = service.selectNext(
      makeContext({ lastSpeakerId: 1, disabledMembers: [2] }),
      ActivationStrategy.LIST,
    );
    expect(result).toBe(3);
  });
});
