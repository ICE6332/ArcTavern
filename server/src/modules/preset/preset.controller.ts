import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, NotFoundException,
} from '@nestjs/common';
import { PresetService } from './preset.service';

@Controller('presets')
export class PresetController {
  constructor(private readonly presetService: PresetService) {}

  @Get()
  async findAll(@Query('apiType') apiType?: string) {
    return this.presetService.findAll(apiType);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const preset = await this.presetService.findOne(id);
    if (!preset) throw new NotFoundException('Preset not found');
    return preset;
  }

  @Post()
  async create(@Body() body: { name: string; apiType: string; data: string }) {
    return this.presetService.create(body);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    const existing = await this.presetService.findOne(id);
    if (!existing) throw new NotFoundException('Preset not found');
    return this.presetService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.presetService.findOne(id);
    if (!existing) throw new NotFoundException('Preset not found');
    return this.presetService.remove(id);
  }
}
