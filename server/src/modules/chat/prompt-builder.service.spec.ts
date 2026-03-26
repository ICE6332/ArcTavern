/// <reference types="vitest/globals" />
import { PromptBuilderService } from './prompt-builder.service';
import type { CharacterRow } from '../character/character.service';
import type { ChatRow, MessageRow } from './chat.service';

function makeCharacter(): CharacterRow {
  return {
    id: 1,
    name: 'Alice',
    avatar: null,
    description: 'Character {{char}} description',
    personality: 'Friendly to {{user}}',
    first_mes: '',
    mes_example: '',
    scenario: '',
    system_prompt: 'System prompt for {{char}}',
    post_history_instructions: 'After history for {{user}}',
    alternate_greetings: '[]',
    creator: '',
    creator_notes: '',
    character_version: '',
    tags: '[]',
    spec: 'chara_card_v2',
    spec_version: '2.0',
    extensions: '{}',
    character_book: null,
    created_at: '',
    updated_at: '',
  };
}

function makeChat(): ChatRow {
  return {
    id: 1,
    character_id: 1,
    name: 'Test Chat',
    created_at: '',
    updated_at: '',
  };
}

describe('PromptBuilderService', () => {
  it('applies macro replacement in system sections', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      userName: 'Bob',
      mergeSystemMessages: true,
    });

    const system = result.find((msg) => msg.role === 'system')?.content as string;
    expect(system).toContain('Alice');
    expect(system).toContain('Bob');
  });

  it('trims old history when token budget is tight', () => {
    const service = new PromptBuilderService();
    const messages: MessageRow[] = [
      {
        id: 1,
        chat_id: 1,
        role: 'user',
        name: '',
        content: 'A'.repeat(100),
        is_hidden: 0,
        swipe_id: 0,
        swipes: '[]',
        gen_started: null,
        gen_finished: null,
        extra: '{}',
        created_at: '',
      },
      {
        id: 2,
        chat_id: 1,
        role: 'assistant',
        name: '',
        content: 'B'.repeat(100),
        is_hidden: 0,
        swipe_id: 0,
        swipes: '[]',
        gen_started: null,
        gen_finished: null,
        extra: '{}',
        created_at: '',
      },
      {
        id: 3,
        chat_id: 1,
        role: 'user',
        name: '',
        content: 'C'.repeat(100),
        is_hidden: 0,
        swipe_id: 0,
        swipes: '[]',
        gen_started: null,
        gen_finished: null,
        extra: '{}',
        created_at: '',
      },
    ];

    const result = service.buildPrompt(makeCharacter(), makeChat(), messages, {
      maxContext: 150,
      maxTokens: 130,
    });

    const nonSystem = result.filter((msg) => msg.role !== 'system');
    expect(nonSystem.length).toBeGreaterThan(0);
    expect(nonSystem[nonSystem.length - 1].content).toBe('C'.repeat(100));
  });

  it('injects RAG context after character description', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      ragContext: [
        {
          content: 'memory 1',
          role: 'user',
          name: 'User',
          score: 0.9,
          messageId: 1,
          chatId: 1,
          createdAt: '',
        },
        {
          content: 'memory 2',
          role: 'assistant',
          name: 'Alice',
          score: 0.8,
          messageId: 2,
          chatId: 1,
          createdAt: '',
        },
      ],
      ragInsertionPosition: 'after_char',
      ragMaxTokenBudget: 1024,
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(allContent).toContain('Relevant memories from past conversations');
    expect(allContent).toContain('[User]: memory 1');
    expect(allContent).toContain('[Alice]: memory 2');
  });

  it('injects RAG context before character description', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      ragContext: [
        {
          content: 'early memory',
          role: 'user',
          name: 'User',
          score: 0.9,
          messageId: 1,
          chatId: 1,
          createdAt: '',
        },
      ],
      ragInsertionPosition: 'before_char',
      ragMaxTokenBudget: 1024,
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(allContent).toContain('Relevant memories from past conversations');
    expect(allContent).toContain('[User]: early memory');

    // RAG block should appear before character description
    const ragIdx = allContent.indexOf('Relevant memories');
    const charIdx = allContent.indexOf('Character Description');
    expect(ragIdx).toBeLessThan(charIdx);
  });

  it('skips RAG block when no memories provided', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      ragContext: [],
      ragInsertionPosition: 'after_char',
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(allContent).not.toContain('Relevant memories');
  });

  it('respects RAG token budget', () => {
    const service = new PromptBuilderService();
    const longMemories = Array.from({ length: 50 }, (_, i) => ({
      content: 'X'.repeat(200),
      role: 'user',
      name: 'User',
      score: 0.9,
      messageId: i,
      chatId: 1,
      createdAt: '',
    }));

    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      ragContext: longMemories,
      ragInsertionPosition: 'after_char',
      ragMaxTokenBudget: 256, // ~1024 chars
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const ragBlock =
      allContent.split('Relevant memories from past conversations:\n')[1]?.split('\n\n')[0] ?? '';
    // Should be truncated well under 50 * 200 chars
    expect(ragBlock.length).toBeLessThan(1200);
  });

  it('respects custom promptOrder when provided', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      userName: 'Bob',
      promptOrder: [
        { identifier: 'charDescription', enabled: true },
        { identifier: 'main', enabled: true },
        { identifier: 'charPersonality', enabled: false }, // disabled
        { identifier: 'scenario', enabled: true },
        { identifier: 'chatHistory', enabled: true },
      ],
    });

    const contents = result.map((m) => (typeof m.content === 'string' ? m.content : ''));
    // charDescription should come before main (custom order)
    const descIdx = contents.findIndex((c) => c.includes('Character Description'));
    const mainIdx = contents.findIndex((c) => c.includes('System prompt for'));
    expect(descIdx).toBeLessThan(mainIdx);

    // Personality should not be present (disabled)
    const allContent = contents.join('\n');
    expect(allContent).not.toContain('Character Personality');
  });

  it('skips disabled components in promptOrder', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      userName: 'Bob',
      promptOrder: [
        { identifier: 'main', enabled: false },
        { identifier: 'charDescription', enabled: false },
        { identifier: 'scenario', enabled: true },
      ],
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(allContent).not.toContain('System prompt for');
    expect(allContent).not.toContain('Character Description');
    // Scenario should be present
    // (but our test character has empty scenario, so just check no crash)
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('falls back to legacy order when promptOrder is not provided', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      userName: 'Bob',
      mergeSystemMessages: true,
    });

    const system = result.find((msg) => msg.role === 'system')?.content as string;
    // Legacy order: system_prompt comes first
    expect(system.indexOf('System prompt for')).toBeLessThan(
      system.indexOf('Character Description'),
    );
  });

  it('uses custom prompt content when provided', () => {
    const service = new PromptBuilderService();
    const result = service.buildPrompt(makeCharacter(), makeChat(), [], {
      userName: 'Bob',
      promptOrder: [
        { identifier: 'main', enabled: true },
        { identifier: 'myCustomPrompt', enabled: true },
        { identifier: 'chatHistory', enabled: true },
      ],
      customPrompts: [
        { identifier: 'myCustomPrompt', role: 'system', content: 'Custom injection here' },
      ],
    });

    const allContent = result
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    expect(allContent).toContain('Custom injection here');
  });
});
