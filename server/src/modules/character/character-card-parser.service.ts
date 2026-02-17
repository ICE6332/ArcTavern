import { BadRequestException, Injectable } from '@nestjs/common';
import extract from 'png-chunks-extract';
import encode from 'png-chunks-encode';
import * as PNGText from 'png-chunk-text';

export interface TavernCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    creator: string;
    character_version: string;
    tags: string[];
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    extensions: {
      talkativeness: number;
      fav: boolean;
      world: string;
      depth_prompt: {
        prompt: string;
        depth: number;
        role: 'system' | 'user' | 'assistant';
      };
      [key: string]: unknown;
    };
    character_book?: {
      entries: unknown[];
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  };
}

@Injectable()
export class CharacterCardParserService {
  read(buffer: Buffer): TavernCardV2 {
    let chunks: Array<{ name: string; data: Uint8Array }>;
    try {
      chunks = extract(new Uint8Array(buffer)) as Array<{ name: string; data: Uint8Array }>;
    } catch {
      throw new BadRequestException('Invalid PNG file');
    }

    const textChunks = chunks
      .filter((chunk) => chunk.name === 'tEXt')
      .map((chunk) => {
        try {
          return PNGText.decode(chunk.data);
        } catch {
          return null;
        }
      })
      .filter((chunk): chunk is { keyword: string; text: string } => Boolean(chunk));

    const payloadChunk =
      textChunks.find((chunk) => chunk.keyword === 'ccv3') ??
      textChunks.find((chunk) => chunk.keyword === 'chara');

    if (!payloadChunk) {
      throw new BadRequestException('No TavernCard metadata found in PNG');
    }

    const parsed = this.decodePayload(payloadChunk.text);
    return this.normalizeCard(parsed);
  }

  normalize(input: unknown): TavernCardV2 {
    return this.normalizeCard(input);
  }

  write(buffer: Buffer, data: TavernCardV2): Buffer {
    let chunks: Array<{ name: string; data: Uint8Array }>;
    try {
      chunks = extract(new Uint8Array(buffer)) as Array<{ name: string; data: Uint8Array }>;
    } catch {
      throw new BadRequestException('Invalid PNG file');
    }

    const cleanChunks = chunks.filter((chunk) => {
      if (chunk.name !== 'tEXt') return true;
      try {
        const decoded = PNGText.decode(chunk.data);
        return decoded.keyword !== 'chara' && decoded.keyword !== 'ccv3';
      } catch {
        return true;
      }
    });

    const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
    const metadataChunk = PNGText.encode('chara', payload) as {
      name: string;
      data: Uint8Array;
    };

    const iendIndex = cleanChunks.findIndex((chunk) => chunk.name === 'IEND');
    const outputChunks = [...cleanChunks];
    outputChunks.splice(iendIndex >= 0 ? iendIndex : outputChunks.length, 0, metadataChunk);

    const encoded = encode(outputChunks);
    return Buffer.from(encoded);
  }

  private decodePayload(text: string): unknown {
    const trimmed = text.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      // ignore and try base64 decode below
    }

    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      throw new BadRequestException('Failed to decode TavernCard metadata');
    }
  }

  private normalizeCard(input: unknown): TavernCardV2 {
    const inputRecord =
      input && typeof input === 'object'
        ? (input as Record<string, unknown>)
        : null;
    const sourceCandidate = inputRecord?.data ?? input;
    if (!sourceCandidate || typeof sourceCandidate !== 'object') {
      throw new BadRequestException('Invalid TavernCard payload');
    }
    const source = sourceCandidate as Record<string, unknown>;

    const safeExtensions =
      source.extensions && typeof source.extensions === 'object'
        ? (source.extensions as Record<string, unknown>)
        : {};
    const depthPrompt =
      safeExtensions.depth_prompt && typeof safeExtensions.depth_prompt === 'object'
        ? (safeExtensions.depth_prompt as Record<string, unknown>)
        : null;
    const tags = Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    const alternateGreetingsSource = Array.isArray(source.alternate_greetings)
      ? source.alternate_greetings
      : Array.isArray(source.alternateGreetings)
        ? source.alternateGreetings
        : [];
    const alternateGreetings = alternateGreetingsSource.filter(
      (greeting): greeting is string => typeof greeting === 'string',
    );
    const role = depthPrompt?.role;
    const depthPromptRole: 'system' | 'user' | 'assistant' =
      role === 'system' || role === 'user' || role === 'assistant'
        ? role
        : 'system';

    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: typeof source.name === 'string' ? source.name : '',
        description: typeof source.description === 'string' ? source.description : '',
        personality: typeof source.personality === 'string' ? source.personality : '',
        scenario: typeof source.scenario === 'string' ? source.scenario : '',
        first_mes:
          typeof source.first_mes === 'string'
            ? source.first_mes
            : typeof source.firstMes === 'string'
              ? source.firstMes
              : '',
        mes_example:
          typeof source.mes_example === 'string'
            ? source.mes_example
            : typeof source.mesExample === 'string'
              ? source.mesExample
              : '',
        creator_notes:
          typeof source.creator_notes === 'string'
            ? source.creator_notes
            : typeof source.creatorNotes === 'string'
              ? source.creatorNotes
              : '',
        creator: typeof source.creator === 'string' ? source.creator : '',
        character_version:
          typeof source.character_version === 'string'
            ? source.character_version
            : typeof source.characterVersion === 'string'
              ? source.characterVersion
              : '',
        tags,
        system_prompt:
          typeof source.system_prompt === 'string'
            ? source.system_prompt
            : typeof source.systemPrompt === 'string'
              ? source.systemPrompt
              : '',
        post_history_instructions:
          typeof source.post_history_instructions === 'string'
            ? source.post_history_instructions
            : typeof source.postHistoryInstructions === 'string'
              ? source.postHistoryInstructions
              : '',
        alternate_greetings: alternateGreetings,
        extensions: {
          talkativeness:
            typeof safeExtensions.talkativeness === 'number'
              ? safeExtensions.talkativeness
              : 0.5,
          fav: Boolean(safeExtensions.fav),
          world: typeof safeExtensions.world === 'string' ? safeExtensions.world : '',
          depth_prompt: depthPrompt
            ? {
                prompt: depthPrompt.prompt?.toString() ?? '',
                depth: typeof depthPrompt.depth === 'number' ? depthPrompt.depth : 4,
                role: depthPromptRole,
              }
            : {
                prompt: '',
                depth: 4,
                role: 'system',
              },
          ...(safeExtensions as Record<string, unknown>),
        },
        character_book:
          source.character_book && typeof source.character_book === 'object'
            ? {
                ...(source.character_book as Record<string, unknown>),
                entries: Array.isArray(
                  (source.character_book as Record<string, unknown>).entries,
                )
                  ? ((source.character_book as Record<string, unknown>)
                      .entries as unknown[])
                  : [],
              }
            : null,
      },
    };
  }
}
