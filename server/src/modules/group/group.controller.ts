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
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GroupService } from './group.service';
import { GroupTurnOrderService, ActivationStrategy } from './group-turn-order.service';
import { ChatService } from '../chat/chat.service';
import { CharacterService } from '../character/character.service';
import { PromptBuilderService } from '../chat/prompt-builder.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import type { CompletionRequest } from '../ai-provider/types';

@Controller('groups')
export class GroupController {
  private readonly activeGroupGenerations = new Map<string, AbortController>();

  constructor(
    private readonly groupService: GroupService,
    private readonly turnOrderService: GroupTurnOrderService,
    private readonly chatService: ChatService,
    private readonly characterService: CharacterService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  @Get()
  async findAll() {
    return this.groupService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const group = await this.groupService.findOne(id);
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  @Post()
  async create(
    @Body() body: {
      name: string;
      avatarUrl?: string;
      activationStrategy?: number;
      generationMode?: number;
    },
  ) {
    return this.groupService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const existing = await this.groupService.findOne(id);
    if (!existing) throw new NotFoundException('Group not found');
    return this.groupService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.groupService.findOne(id);
    if (!existing) throw new NotFoundException('Group not found');
    return this.groupService.remove(id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    const existing = await this.groupService.findOne(id);
    if (!existing) throw new NotFoundException('Group not found');
    return this.groupService.getMembers(id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() body: { characterId: number; sortOrder?: number },
  ) {
    const existing = await this.groupService.findOne(id);
    if (!existing) throw new NotFoundException('Group not found');
    return this.groupService.addMember(id, body.characterId, body.sortOrder);
  }

  @Delete(':id/members/:characterId')
  async removeMember(
    @Param('id') id: string,
    @Param('characterId', ParseIntPipe) characterId: number,
  ) {
    const existing = await this.groupService.findOne(id);
    if (!existing) throw new NotFoundException('Group not found');
    return this.groupService.removeMember(id, characterId);
  }

  @Post(':id/generate')
  async generate(
    @Param('id') id: string,
    @Body() body: Omit<CompletionRequest, 'messages' | 'stream'> & {
      chatId: number;
      message?: string;
      userName?: string;
      maxContext?: number;
      characterId?: number;
    },
    @Res() res: Response,
  ) {
    const group = await this.groupService.findOne(id);
    if (!group) throw new NotFoundException('Group not found');

    if (!body.provider || !body.model) {
      throw new BadRequestException('provider and model are required');
    }

    const chat = await this.chatService.findOne(body.chatId);
    if (!chat) throw new NotFoundException('Chat not found');

    if (body.message?.trim()) {
      await this.chatService.addMessage({
        chatId: body.chatId,
        role: 'user',
        name: body.userName ?? 'User',
        content: body.message.trim(),
      });
    }

    const messages = await this.chatService.getMessages(body.chatId);
    const members = await this.groupService.getMembers(id);
    const characters = [];
    for (const m of members) {
      const char = await this.characterService.findOne(m.character_id);
      if (char) characters.push(char);
    }

    let speakerId = body.characterId;
    if (!speakerId) {
      let disabled: number[] = [];
      try {
        disabled = JSON.parse(group.disabled_members);
      } catch {}

      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      const lastChar = lastAssistant?.name
        ? characters.find((c) => c.name === lastAssistant.name)
        : null;

      const selected = this.turnOrderService.selectNext(
        {
          members: members.map((m) => ({ characterId: m.character_id, sortOrder: m.sort_order })),
          characters,
          recentMessages: messages,
          disabledMembers: disabled,
          lastSpeakerId: lastChar?.id,
        },
        group.activation_strategy as ActivationStrategy,
      );

      if (!selected) throw new BadRequestException('No character selected for turn');
      speakerId = selected;
    }

    const character = characters.find((c) => c.id === speakerId);
    if (!character) throw new NotFoundException('Selected character not found');

    const promptMessages = this.promptBuilder.buildPrompt(character, chat, messages, {
      maxTokens: body.maxTokens,
      maxContext: body.maxContext,
      userName: body.userName ?? 'User',
      mergeSystemMessages: true,
    });

    const abortController = new AbortController();
    this.activeGroupGenerations.set(id, abortController);
    res.on('close', () => {
      abortController.abort();
      this.activeGroupGenerations.delete(id);
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ speaker: character.name, speakerId: character.id })}\n\n`);

    const completionRequest: CompletionRequest = {
      ...body,
      messages: promptMessages,
      stream: true,
    };

    let fullContent = '';
    let fullReasoning = '';
    try {
      for await (const chunk of this.aiProviderService.streamComplete(
        completionRequest,
        abortController.signal,
      )) {
        if (chunk.content) {
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
        }
        if (chunk.reasoning) {
          fullReasoning += chunk.reasoning;
          res.write(`data: ${JSON.stringify({ reasoning: chunk.reasoning })}\n\n`);
        }
      }

      if (!abortController.signal.aborted && fullContent.trim()) {
        const extra = fullReasoning
          ? JSON.stringify({ reasoning: fullReasoning, reasoningSwipes: [fullReasoning] })
          : '{}';
        await this.chatService.addMessage({
          chatId: body.chatId,
          role: 'assistant',
          name: character.name,
          content: fullContent,
          swipes: JSON.stringify([fullContent]),
          genStarted: new Date().toISOString(),
          genFinished: new Date().toISOString(),
          extra,
        });
      }

      res.write('data: [DONE]\n\n');
    } catch (error: unknown) {
      if (!abortController.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.write(`data: ${JSON.stringify({ error: `[ERROR] ${message}` })}\n\n`);
      }
    } finally {
      this.activeGroupGenerations.delete(id);
      res.end();
    }
  }
}
