import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { CharacterService } from './character.service';

@Controller('characters')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

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

  @Post()
  async create(@Body() body: { name: string; [key: string]: unknown }) {
    return this.characterService.create(body as Parameters<CharacterService['create']>[0]);
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

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.characterService.findOne(id);
    if (!existing) throw new NotFoundException('Character not found');
    return this.characterService.remove(id);
  }
}
