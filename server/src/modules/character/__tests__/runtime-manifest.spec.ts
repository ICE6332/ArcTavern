import { describe, expect, it } from 'vitest';
import { analyzeRuntimeManifest } from '../runtime-manifest';
import type { TavernCardV2 } from '../character-card-parser.service';

function makeCard(overrides: Partial<TavernCardV2['data']> = {}): TavernCardV2 {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Test',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      creator: '',
      character_version: '',
      tags: [],
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      extensions: {
        talkativeness: 0.5,
        fav: false,
        world: '',
        depth_prompt: {
          prompt: '',
          depth: 4,
          role: 'system',
        },
      },
      character_book: null,
      ...overrides,
    },
  };
}

describe('analyzeRuntimeManifest', () => {
  it('keeps plain text cards on native runtime', () => {
    const manifest = analyzeRuntimeManifest(makeCard({ first_mes: 'Hello there.' }));

    expect(manifest.runtimeMode).toBe('native');
    expect(manifest.promptCompat).toBe(false);
    expect(manifest.renderCompat).toBe(false);
  });

  it('classifies ERA cards into compat sandbox', () => {
    const manifest = analyzeRuntimeManifest(
      makeCard({
        first_mes: '<VariableInsert>{"player":{"name":"<user>"}}</VariableInsert>',
        extensions: {
          talkativeness: 0.5,
          fav: false,
          world: '',
          depth_prompt: { prompt: '', depth: 4, role: 'system' },
          regex_scripts: [
            {
              scriptName: 'status',
              findRegex: '/<StatusPlaceHolderImpl\\/>/g',
              replaceString: '```html\n<!DOCTYPE html><html><body>status</body></html>\n```',
              placement: [2],
            },
          ],
        },
      }),
    );

    expect(manifest.runtimeMode).toBe('compat-sandbox');
    expect(manifest.adapter).toBe('era');
    expect(manifest.promptCompat).toBe(true);
    expect(manifest.renderCompat).toBe(true);
  });

  it('classifies Fate cards by regex-driven render and lorebook regex conditions', () => {
    const manifest = analyzeRuntimeManifest(
      makeCard({
        extensions: {
          talkativeness: 0.5,
          fav: false,
          world: '',
          depth_prompt: { prompt: '', depth: 4, role: 'system' },
          regex_scripts: [
            {
              scriptName: 'opening',
              findRegex: '/<opening>([\\s\\S]*?)<\\/opening>/gi',
              replaceString: '<div style="color:red">$1</div>',
              placement: [2],
            },
          ],
        },
        character_book: {
          name: 'Fate',
          entries: [
            {
              keys: ['Saber'],
              secondary_keys: ['/20[0-4][0-9]年/'],
              selective: true,
              content: '<Sabercharacter>...</Sabercharacter>',
            },
          ],
        },
      }),
    );

    expect(manifest.runtimeMode).toBe('compat-sandbox');
    expect(manifest.adapter).toBe('fate');
    expect(manifest.promptCompat).toBe(true);
    expect(manifest.renderCompat).toBe(true);
    expect(manifest.capabilities.lorebookRegex).toBe(true);
  });
});
