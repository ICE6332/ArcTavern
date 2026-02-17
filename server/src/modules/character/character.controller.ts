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
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { CharacterService } from './character.service';
import {
  CharacterCardParserService,
  TavernCardV2,
} from './character-card-parser.service';

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

  private toCard(character: Awaited<ReturnType<CharacterService['findOne']>>): TavernCardV2 {
    if (!character) throw new NotFoundException('Character not found');

    const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
      if (!value) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };

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
        character_book: parseJson(character.character_book, null),
      },
    };
  }

  private fromCard(card: TavernCardV2) {
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
      extensions: JSON.stringify(card.data.extensions ?? {}),
      characterBook: card.data.character_book
        ? JSON.stringify(card.data.character_book)
        : null,
      spec: card.spec,
      specVersion: card.spec_version,
    };
  }

  @Get()
  async findAll() {
    return this.characterService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const character = await this.characterService.findOne(id);
    if (!character) throw new NotFoundException('Character not found');
    return character;
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
    return created;
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
    const card = this.toCard(character);

    const fileNameSafe = character.name.replace(/[^\w.-]+/g, '_') || `character-${id}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameSafe}.json"`);
      res.send(JSON.stringify(card, null, 2));
      return;
    }

    const avatarPath = path.join(this.characterAvatarDir, `${id}.png`);
    const basePng = fs.existsSync(avatarPath)
      ? fs.readFileSync(avatarPath)
      : this.defaultAvatarPng;
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
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
