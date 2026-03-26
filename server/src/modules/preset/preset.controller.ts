import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { PresetService } from './preset.service';

@Controller('presets')
export class PresetController {
  constructor(private readonly presetService: PresetService) {}

  @Get()
  findAll(@Query('apiType') apiType?: string) {
    return this.presetService.findAll(apiType);
  }

  /** Import a preset (full JSON blob) — must be before :id routes */
  @Post('import')
  importPreset(@Body() body: { name: string; apiType: string; data: Record<string, unknown> }) {
    return this.presetService.importPreset(body.name, body.apiType, body.data);
  }

  /** List default preset names for a type — must be before :id routes */
  @Get('defaults/:apiType')
  getDefaults(@Param('apiType') apiType: string) {
    return this.presetService.getDefaultNames(apiType);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    const preset = this.presetService.findOne(id);
    if (!preset) throw new NotFoundException('Preset not found');
    return preset;
  }

  /** Export preset as JSON */
  @Get(':id/export')
  exportPreset(@Param('id', ParseIntPipe) id: number) {
    const result = this.presetService.exportPreset(id);
    if (!result) throw new NotFoundException('Preset not found');
    return result;
  }

  @Post()
  create(@Body() body: { name: string; apiType: string; data: string }) {
    return this.presetService.create(body);
  }

  /** Restore a default preset to its original state */
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    const existing = this.presetService.findOne(id);
    if (!existing) throw new NotFoundException('Preset not found');
    return this.presetService.restore(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    const existing = this.presetService.findOne(id);
    if (!existing) throw new NotFoundException('Preset not found');
    return this.presetService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    const existing = this.presetService.findOne(id);
    if (!existing) throw new NotFoundException('Preset not found');
    return this.presetService.remove(id);
  }
}
