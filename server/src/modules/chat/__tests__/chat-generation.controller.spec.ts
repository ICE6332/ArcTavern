/// <reference types="vitest/globals" />
import { ChatGenerationController } from '../chat-generation.controller';
import type { ChatService } from '../chat.service';
import type { CharacterService } from '../../character/character.service';
import type { PromptBuilderService } from '../prompt-builder.service';
import type { AiProviderService } from '../../ai-provider/ai-provider.service';
import type { WorldInfoService } from '../../world-info/world-info.service';
import type { WorldInfoScannerService } from '../../world-info/world-info-scanner.service';
import type { WorldInfoVectorService } from '../../world-info/world-info-vector.service';
import type { PersonaService } from '../../persona/persona.service';
import type { RagService } from '../../rag/rag.service';
import type { CompatPromptRuntimeService } from '../compat-prompt-runtime.service';

function makeController() {
  const chatService = {
    findMessageById: vi.fn(),
    updateMessage: vi.fn(),
  };
  const controller = new ChatGenerationController(
    chatService as unknown as ChatService,
    {} as CharacterService,
    {} as PromptBuilderService,
    {} as AiProviderService,
    {} as WorldInfoService,
    {} as WorldInfoScannerService,
    {} as WorldInfoVectorService,
    {} as PersonaService,
    {} as RagService,
    {
      prepare: vi.fn().mockResolvedValue({
        manifest: null,
        adapter: null,
        namespaces: {
          global: {},
          chat: {},
          character: {},
          session: {},
        },
        sessionState: {},
        eraData: null,
        messageCompat: {},
      }),
      renderCharacter: vi.fn(async (character) => character),
      renderEntries: vi.fn(async (entries) => entries),
    } as unknown as CompatPromptRuntimeService,
  );
  return { controller, chatService };
}

describe('ChatGenerationController', () => {
  it('switches swipe to the right and updates content', async () => {
    const { controller, chatService } = makeController();

    chatService.findMessageById.mockResolvedValue({
      id: 1,
      chat_id: 1,
      role: 'assistant',
      name: '',
      content: 'one',
      is_hidden: 0,
      swipe_id: 0,
      swipes: JSON.stringify(['one', 'two']),
      gen_started: null,
      gen_finished: null,
      extra: '{}',
      created_at: '',
    });
    chatService.updateMessage.mockResolvedValue({
      id: 1,
      content: 'two',
      swipe_id: 1,
    });

    const result = await controller.swipe(1, { direction: 'right' });

    expect(chatService.updateMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        swipeId: 1,
        content: 'two',
      }),
    );
    expect(result).toEqual({ id: 1, content: 'two', swipe_id: 1 });
  });

  it('appends provided swipe content', async () => {
    const { controller, chatService } = makeController();

    chatService.findMessageById.mockResolvedValue({
      id: 2,
      chat_id: 1,
      role: 'assistant',
      name: '',
      content: 'base',
      is_hidden: 0,
      swipe_id: 0,
      swipes: '[]',
      gen_started: null,
      gen_finished: null,
      extra: '{}',
      created_at: '',
    });
    chatService.updateMessage.mockResolvedValue({ id: 2, content: 'new option' });

    await controller.swipe(2, { content: 'new option' });
    const [, payload] = chatService.updateMessage.mock.calls[0];

    expect(payload.content).toBe('new option');
    expect(JSON.parse(payload.swipes)).toContain('new option');
  });
});
