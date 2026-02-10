import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async findByCharacter(@Query('characterId', ParseIntPipe) characterId: number) {
    return this.chatService.findAllByCharacter(characterId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const chat = await this.chatService.findOne(id);
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  @Post()
  async create(@Body() body: { characterId: number; name?: string }) {
    return this.chatService.create(body.characterId, body.name);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const chat = await this.chatService.findOne(id);
    if (!chat) throw new NotFoundException('Chat not found');
    return this.chatService.remove(id);
  }

  // Messages
  @Get(':id/messages')
  async getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getMessages(id);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id', ParseIntPipe) chatId: number,
    @Body() body: { role: 'user' | 'assistant' | 'system'; name?: string; content: string },
  ) {
    return this.chatService.addMessage({ chatId, ...body });
  }

  @Put('messages/:messageId')
  async updateMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.chatService.updateMessage(messageId, body);
  }

  @Delete('messages/:messageId')
  async deleteMessage(@Param('messageId', ParseIntPipe) messageId: number) {
    return this.chatService.deleteMessage(messageId);
  }
}
