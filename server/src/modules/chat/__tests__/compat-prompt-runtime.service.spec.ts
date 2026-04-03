/// <reference types="vitest/globals" />
import { CompatPromptRuntimeService } from '../compat-prompt-runtime.service';
import { createMinimalCharacterRow } from '@/test/fixtures/prompt-builder';
import type { MessageRow } from '../chat.service';

function makeMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 1,
    chat_id: 1,
    role: 'assistant',
    name: '',
    content: '',
    is_hidden: 0,
    swipe_id: 0,
    swipes: '[]',
    gen_started: null,
    gen_finished: null,
    extra: '{}',
    created_at: '',
    ...overrides,
  };
}

describe('CompatPromptRuntimeService', () => {
  it('extracts VariableInsert state and persists compat session', async () => {
    const settingsService = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CompatPromptRuntimeService(settingsService as never);
    const character = createMinimalCharacterRow({
      extensions: JSON.stringify({
        runtimeManifest: {
          runtimeMode: 'compat-sandbox',
          adapter: 'era',
          promptCompat: true,
          renderCompat: true,
          capabilities: {},
          detectedFeatures: ['variable_insert'],
        },
      }),
    });

    const context = await service.prepare(character, 7, [
      makeMessage({
        content:
          '<VariableInsert>{"world_state":{"location":"旧校舍"},"player":{"san":80}}</VariableInsert>',
      }),
    ]);

    expect(context.adapter).toBe('era');
    expect(context.sessionState).toEqual({
      world_state: { location: '旧校舍' },
      player: { san: 80 },
    });
    expect(settingsService.set).toHaveBeenCalledWith(
      'compat:session:7:1',
      expect.objectContaining({
        stat_data: context.sessionState,
      }),
    );
  });

  it('renders ERA EJS-style templates with getvar access', async () => {
    const settingsService = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CompatPromptRuntimeService(settingsService as never);
    const character = createMinimalCharacterRow({
      extensions: JSON.stringify({
        runtimeManifest: {
          runtimeMode: 'compat-sandbox',
          adapter: 'era',
          promptCompat: true,
          renderCompat: true,
          capabilities: {},
          detectedFeatures: ['variable_insert'],
        },
      }),
    });

    const context = await service.prepare(character, 3, [
      makeMessage({
        content: '<VariableInsert>{"world_state":{"location":"旧校舍-3F-女厕所"}}</VariableInsert>',
      }),
    ]);

    const rendered = await service.renderContent(
      "当前位置：<%= await (async () => getvar('stat_data.world_state.location'))() %>",
      context,
    );

    expect(rendered).toContain('旧校舍-3F-女厕所');
  });

  it('expands ERA all-data placeholder from compat session state', async () => {
    const settingsService = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CompatPromptRuntimeService(settingsService as never);
    const character = createMinimalCharacterRow({
      extensions: JSON.stringify({
        runtimeManifest: {
          runtimeMode: 'compat-sandbox',
          adapter: 'era',
          promptCompat: true,
          renderCompat: true,
          capabilities: {},
          detectedFeatures: ['variable_insert'],
        },
      }),
    });

    const context = await service.prepare(character, 3, [
      makeMessage({
        content:
          '<VariableInsert>{"player":{"name":"<user>"},"world_state":{"location":"旧校舍"}}</VariableInsert>',
      }),
    ]);

    const rendered = await service.renderContent('状态:\n{{ERA:$ALLDATA}}', context);
    expect(rendered).toContain('"player"');
    expect(rendered).toContain('"world_state"');
  });
});
