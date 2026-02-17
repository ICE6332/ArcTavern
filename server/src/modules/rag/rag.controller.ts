import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import type { RagSettings } from './types';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('settings')
  async getSettings() {
    return this.ragService.getSettings();
  }

  @Post('settings')
  async updateSettings(@Body() body: Partial<RagSettings>) {
    return this.ragService.saveSettings(body);
  }

  @Delete('chat/:chatId/vectors')
  async deleteChatVectors(@Param('chatId', ParseIntPipe) chatId: number) {
    await this.ragService.deleteChatVectors(chatId);
    return { deleted: true };
  }

  @Delete('message/:messageId/vectors')
  async deleteMessageVectors(@Param('messageId', ParseIntPipe) messageId: number) {
    await this.ragService.deleteMessageVectors(messageId);
    return { deleted: true };
  }

  @Delete('character/:characterId/vectors')
  async deleteCharacterVectors(@Param('characterId', ParseIntPipe) characterId: number) {
    await this.ragService.deleteCharacterVectors(characterId);
    return { deleted: true };
  }
}
