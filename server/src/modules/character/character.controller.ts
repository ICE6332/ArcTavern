import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CharacterService } from './character.service';
import { CharacterCardParserService, TavernCardV2 } from './character-card-parser.service';
import { analyzeRuntimeManifest } from './runtime-manifest';
import { WorldInfoService } from '../world-info/world-info.service';

interface UploadedBinaryFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller('characters')
export class CharacterController {
  constructor(
    private readonly characterService: CharacterService,
    private readonly characterCardParser: CharacterCardParserService,
    private readonly worldInfoService: WorldInfoService,
  ) {}

  private readonly defaultAvatarPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+X7xL3QAAAABJRU5ErkJggg==',
    'base64',
  );

  private get characterAvatarDir() {
    return path.resolve(process.cwd(), 'data', 'characters');
  }

  private ensureAvatarDir() {
    if (!fs.existsSync(this.characterAvatarDir)) {
      fs.mkdirSync(this.characterAvatarDir, { recursive: true });
    }
  }

  private async toCard(
    character: Awaited<ReturnType<CharacterService['findOne']>>,
  ): Promise<TavernCardV2> {
    if (!character) throw new NotFoundException('Character not found');

    const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
      if (!value) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };

    // If character has a linked world info book, export live DB data as character_book
    let characterBook: TavernCardV2['data']['character_book'] = null;
    if (character.world_info_book_id) {
      const exported = await this.worldInfoService.exportBook(character.world_info_book_id);
      if (exported) {
        characterBook = {
          name: exported.book.name,
          description: exported.book.description,
          entries: exported.entries.map((e) => ({
            keys: this.safeJsonParse(e.keys, []),
            secondary_keys: this.safeJsonParse(e.secondary_keys, []),
            comment: e.comment,
            content: e.content,
            constant: Boolean(e.constant),
            selective: Boolean(e.selective),
            insertion_order: e.insertion_order,
            enabled: Boolean(e.enabled),
            position: e.position,
            use_probability: Boolean(e.use_probability),
            probability: e.probability,
            depth: e.depth,
            selectiveLogic: e.select_logic,
            group: e.group_name,
            groupOverride: Boolean(e.group_override),
            groupWeight: e.group_weight,
            scanDepth: e.scan_depth,
            caseSensitive: Boolean(e.case_sensitive),
            matchWholeWords: Boolean(e.match_whole_words),
            useGroupScoring: Boolean(e.use_group_scoring),
            automationId: e.automation_id,
            role: e.role,
            sticky: e.sticky,
            cooldown: e.cooldown,
            delay: e.delay,
            use_regex: Boolean(e.use_regex),
          })),
        };
      }
    }
    if (!characterBook) {
      characterBook = parseJson(character.character_book, null);
    }

    return {
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        first_mes: character.first_mes,
        mes_example: character.mes_example,
        creator_notes: character.creator_notes,
        creator: character.creator,
        character_version: character.character_version ?? '',
        tags: parseJson(character.tags, [] as string[]),
        system_prompt: character.system_prompt,
        post_history_instructions: character.post_history_instructions,
        alternate_greetings: parseJson(character.alternate_greetings, [] as string[]),
        extensions: parseJson(character.extensions, {
          talkativeness: 0.5,
          fav: false,
          world: '',
          depth_prompt: { prompt: '', depth: 4, role: 'system' },
        }),
        character_book: characterBook,
      },
    };
  }

  private safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private buildRuntimeManifestCard(character: Awaited<ReturnType<CharacterService['findOne']>>) {
    if (!character) return null;

    const rawExtensions = this.safeJsonParse<Record<string, unknown>>(character.extensions, {});
    const rawDepthPrompt =
      rawExtensions.depth_prompt &&
      typeof rawExtensions.depth_prompt === 'object' &&
      rawExtensions.depth_prompt !== null
        ? (rawExtensions.depth_prompt as Record<string, unknown>)
        : null;
    const rawDepthPromptRole = rawDepthPrompt?.role;
    const depthPromptRole: 'system' | 'user' | 'assistant' =
      rawDepthPromptRole === 'user' || rawDepthPromptRole === 'assistant'
        ? rawDepthPromptRole
        : 'system';
    const extensions = {
      talkativeness:
        typeof rawExtensions.talkativeness === 'number' ? rawExtensions.talkativeness : 0.5,
      fav: Boolean(rawExtensions.fav),
      world: typeof rawExtensions.world === 'string' ? rawExtensions.world : '',
      depth_prompt: rawDepthPrompt
        ? {
            prompt: typeof rawDepthPrompt.prompt === 'string' ? rawDepthPrompt.prompt : '',
            depth: typeof rawDepthPrompt.depth === 'number' ? rawDepthPrompt.depth : 4,
            role: depthPromptRole,
          }
        : {
            prompt: '',
            depth: 4,
            role: 'system' as const,
          },
      ...rawExtensions,
    };
    const rawCharacterBook = this.safeJsonParse<Record<string, unknown> | null>(
      character.character_book,
      null,
    );
    const characterBook = rawCharacterBook
      ? {
          ...rawCharacterBook,
          entries: Array.isArray(rawCharacterBook.entries) ? rawCharacterBook.entries : [],
        }
      : null;

    return {
      spec: 'chara_card_v2' as const,
      spec_version: '2.0' as const,
      data: {
        name: character.name,
        description: character.description,
        personality: character.personality,
        scenario: character.scenario,
        first_mes: character.first_mes,
        mes_example: character.mes_example,
        creator_notes: character.creator_notes,
        creator: character.creator,
        character_version: character.character_version ?? '',
        tags: this.safeJsonParse<string[]>(character.tags, []),
        system_prompt: character.system_prompt,
        post_history_instructions: character.post_history_instructions,
        alternate_greetings: this.safeJsonParse<string[]>(character.alternate_greetings, []),
        extensions,
        character_book: characterBook,
      },
    };
  }

  private async ensureRuntimeManifest<T extends Awaited<ReturnType<CharacterService['findOne']>>>(
    character: T,
  ): Promise<T> {
    if (!character) return character;

    const extensions = this.safeJsonParse<Record<string, unknown>>(character.extensions, {});
    if (extensions.runtimeManifest) return character;

    const runtimeCard = this.buildRuntimeManifestCard(character);
    if (!runtimeCard) return character;

    const nextExtensions = {
      ...extensions,
      runtimeManifest: analyzeRuntimeManifest(runtimeCard),
    };

    await this.characterService.update(character.id, {
      extensions: JSON.stringify(nextExtensions),
    });

    return {
      ...character,
      extensions: JSON.stringify(nextExtensions),
    } as T;
  }

  private fromCard(card: TavernCardV2) {
    const extensions = {
      ...card.data.extensions,
      runtimeManifest: analyzeRuntimeManifest(card),
    };

    return {
      name: card.data.name,
      description: card.data.description,
      personality: card.data.personality,
      scenario: card.data.scenario,
      firstMes: card.data.first_mes,
      mesExample: card.data.mes_example,
      systemPrompt: card.data.system_prompt,
      postHistoryInstructions: card.data.post_history_instructions,
      alternateGreetings: JSON.stringify(card.data.alternate_greetings ?? []),
      creator: card.data.creator,
      creatorNotes: card.data.creator_notes,
      characterVersion: card.data.character_version,
      tags: JSON.stringify(card.data.tags ?? []),
      extensions: JSON.stringify(extensions),
      characterBook: card.data.character_book ? JSON.stringify(card.data.character_book) : null,
      spec: card.spec,
      specVersion: card.spec_version,
    };
  }

  @Get()
  async findAll() {
    const characters = await this.characterService.findAll();
    return Promise.all(characters.map((character) => this.ensureRuntimeManifest(character)));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const character = await this.characterService.findOne(id);
    if (!character) throw new NotFoundException('Character not found');
    return this.ensureRuntimeManifest(character);
  }

  @Get(':id/avatar')
  async getAvatar(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const filePath = path.join(this.characterAvatarDir, `${id}.png`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Avatar not found');
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(fs.readFileSync(filePath));
  }

  @Post()
  async create(@Body() body: { name: string; [key: string]: unknown }) {
    return this.characterService.create(body as Parameters<CharacterService['create']>[0]);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCharacter(@UploadedFile() file?: UploadedBinaryFile) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const type = file.mimetype.toLowerCase();

    let card: TavernCardV2;
    if (type.includes('png') || ext === '.png') {
      card = this.characterCardParser.read(file.buffer);
    } else if (type.includes('yaml') || ext === '.yaml' || ext === '.yml') {
      const parsed = YAML.parse(file.buffer.toString('utf8'));
      card = this.characterCardParser.normalize(parsed);
    } else {
      try {
        const parsed = JSON.parse(file.buffer.toString('utf8'));
        card = this.characterCardParser.normalize(parsed);
      } catch {
        throw new BadRequestException('Unsupported import file format');
      }
    }

    const created = await this.characterService.create(this.fromCard(card));

    // Auto-create world info book from character_book if present
    const charBook = card.data.character_book as
      | { name?: string; description?: string; entries?: Array<Record<string, unknown>> }
      | null
      | undefined;
    if (charBook?.entries?.length) {
      try {
        const book = await this.worldInfoService.importBookWithName(
          charBook.name || `${card.data.name} Lorebook`,
          charBook.description ?? '',
          charBook.entries,
        );
        await this.characterService.update(created.id, { worldInfoBookId: book.id });
      } catch (err) {
        console.warn('Failed to auto-import character lorebook:', err);
      }
    }

    return this.characterService.findOne(created.id) ?? created;
  }

  @Post('export/:id')
  async exportCharacter(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { format?: 'png' | 'json' },
    @Res() res: Response,
  ) {
    const character = await this.characterService.findOne(id);
    if (!character) throw new NotFoundException('Character not found');

    const format = body?.format ?? 'json';
    const card = await this.toCard(character);

    const fileNameSafe = character.name.replace(/[^\w.-]+/g, '_') || `character-${id}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameSafe}.json"`);
      res.send(JSON.stringify(card, null, 2));
      return;
    }

    const avatarPath = path.join(this.characterAvatarDir, `${id}.png`);
    const basePng = fs.existsSync(avatarPath) ? fs.readFileSync(avatarPath) : this.defaultAvatarPng;
    const outputPng = this.characterCardParser.write(basePng, card);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameSafe}.png"`);
    res.send(outputPng);
  }

  @Post('duplicate/:id')
  async duplicate(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.characterService.findOne(id);
    if (!existing) throw new NotFoundException('Character not found');

    return this.characterService.create({
      name: `${existing.name} (Copy)`,
      avatar: existing.avatar ?? undefined,
      description: existing.description,
      personality: existing.personality,
      firstMes: existing.first_mes,
      mesExample: existing.mes_example,
      scenario: existing.scenario,
      systemPrompt: existing.system_prompt,
      postHistoryInstructions: existing.post_history_instructions,
      alternateGreetings: existing.alternate_greetings,
      creator: existing.creator,
      creatorNotes: existing.creator_notes,
      characterVersion: existing.character_version,
      tags: existing.tags,
      extensions: existing.extensions,
      characterBook: existing.character_book,
    });
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    const existing = await this.characterService.findOne(id);
    if (!existing) throw new NotFoundException('Character not found');
    return this.characterService.update(id, body);
  }

  @Patch(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedBinaryFile,
  ) {
    const existing = await this.characterService.findOne(id);
    if (!existing) throw new NotFoundException('Character not found');
    if (!file) throw new BadRequestException('Missing avatar file');

    this.ensureAvatarDir();
    const filePath = path.join(this.characterAvatarDir, `${id}.png`);
    fs.writeFileSync(filePath, file.buffer);

    return this.characterService.update(id, { avatar: `/api/characters/${id}/avatar` });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.characterService.findOne(id);
    if (!existing) throw new NotFoundException('Character not found');
    const avatarPath = path.join(this.characterAvatarDir, `${id}.png`);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }
    return this.characterService.remove(id);
  }
}
