/// <reference types="vitest/globals" />
import { CharacterCardParserService } from '../character-card-parser.service';
import encode from 'png-chunks-encode';
import { deflateSync } from 'zlib';

function createOnePixelPng() {
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const rawScanline = Buffer.from([0, 255, 0, 0, 255]);
  const idat = deflateSync(rawScanline);
  return Buffer.from(
    encode([
      { name: 'IHDR', data: ihdr },
      { name: 'IDAT', data: idat },
      { name: 'IEND', data: Buffer.alloc(0) },
    ]),
  );
}

describe('CharacterCardParserService', () => {
  it('writes and reads TavernCard metadata in PNG', () => {
    const service = new CharacterCardParserService();
    const card = {
      spec: 'chara_card_v2' as const,
      spec_version: '2.0' as const,
      data: {
        name: 'Alice',
        description: 'Desc',
        personality: 'Calm',
        scenario: 'Test',
        first_mes: 'Hi',
        mes_example: '',
        creator_notes: '',
        creator: 'Tester',
        character_version: '1.0',
        tags: ['demo'],
        system_prompt: 'You are {{char}}',
        post_history_instructions: '',
        alternate_greetings: ['Hello'],
        extensions: {
          talkativeness: 0.5,
          fav: false,
          world: '',
          depth_prompt: { prompt: '', depth: 4, role: 'system' as const },
        },
        character_book: null,
      },
    };

    const encoded = service.write(createOnePixelPng(), card);
    const parsed = service.read(encoded);

    expect(parsed.spec).toBe('chara_card_v2');
    expect(parsed.data.name).toBe('Alice');
    expect(parsed.data.tags).toEqual(['demo']);
    expect(parsed.data.alternate_greetings).toEqual(['Hello']);
  });

  it('normalizes raw object input to TavernCard V2 shape', () => {
    const service = new CharacterCardParserService();
    const parsed = service.normalize({
      name: 'Raw Name',
      firstMes: 'Legacy key',
      tags: 'not-an-array',
    });

    expect(parsed.data.name).toBe('Raw Name');
    expect(parsed.data.first_mes).toBe('Legacy key');
    expect(parsed.data.tags).toEqual([]);
  });
});
