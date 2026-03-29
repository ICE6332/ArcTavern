import type { CharacterRow } from '@/modules/character/character.service';
import type { ChatRow } from '@/modules/chat/chat.service';

/** PromptBuilderService 等测试用的最小 Character 行。 */
export function createMinimalCharacterRow(overrides: Partial<CharacterRow> = {}): CharacterRow {
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
    ...overrides,
  };
}

export function createMinimalChatRow(overrides: Partial<ChatRow> = {}): ChatRow {
  return {
    id: 1,
    character_id: 1,
    name: 'Test Chat',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}
