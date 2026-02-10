import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    return this.settingsService.get(key);
  }

  @Post()
  async set(@Body() body: { key: string; value: unknown }) {
    await this.settingsService.set(body.key, body.value);
    return { success: true };
  }
}
