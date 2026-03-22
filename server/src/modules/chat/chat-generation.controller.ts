import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService, type MessageRow } from './chat.service';
import { CharacterService } from '../character/character.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { WorldInfoService } from '../world-info/world-info.service';
import { WorldInfoScannerService } from '../world-info/world-info-scanner.service';
import { PersonaService } from '../persona/persona.service';
import { RagService } from '../rag/rag.service';
import type { CompletionRequest, ChatMessage } from '../ai-provider/types';
import type { RetrievedMemory } from '../rag/types';
import {
  StructuredResponseSchema,
  getStructuredOutputSystemPrompt,
  extractNarrationText,
} from '../ai-provider/structured-output-schema';

type GenerationType =
  | 'normal'
  | 'regenerate'
  | 'swipe'
  | 'continue'
  | 'impersonate'
  | 'quiet';

type GenerateRequest = Omit<CompletionRequest, 'messages' | 'stream'> & {
  type?: GenerationType;
  message?: string;
  userName?: string;
  maxContext?: number;
  worldInfoBookIds?: number[];
  personaId?: string;

  /** Prompt assembly order (from preset's prompt_order) */
  promptOrder?: Array<{
    identifier: string;
    enabled: boolean;
  }>;

  /** Custom prompt component contents (from preset's prompts array) */
  customPrompts?: Array<{
    identifier: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  /** Enable structured JSON output via Output.object() */
  structuredOutput?: boolean;
};

@Controller()
export class ChatGenerationController {
  private readonly activeGenerations = new Map<number, AbortController>();
  private readonly logger = new Logger(ChatGenerationController.name);
  private readonly chatDebugEnabled = ['1', 'true', 'yes', 'on'].includes(
    (process.env.CHAT_DEBUG ?? '').toLowerCase(),
  );

  constructor(
    private readonly chatService: ChatService,
    private readonly characterService: CharacterService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly aiProviderService: AiProviderService,
    private readonly worldInfoService: WorldInfoService,
    private readonly worldInfoScanner: WorldInfoScannerService,
    private readonly personaService: PersonaService,
    private readonly ragService: RagService,
  ) {}

  private chatDebug(event: string, payload?: Record<string, unknown>) {
    if (!this.chatDebugEnabled) return;
    if (payload) {
      this.logger.log(`[chat-debug] ${event} ${JSON.stringify(payload)}`);
      return;
    }
    this.logger.log(`[chat-debug] ${event}`);
  }

  @Post('chat/:chatId/generate')
  async generate(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() body: GenerateRequest,
    @Res() res: Response,
  ) {
    const requestTag = `${chatId}-${Date.now().toString(36)}`;
    const chat = await this.chatService.findOne(chatId);
    if (!chat) throw new NotFoundException('Chat not found');

    const character = await this.characterService.findOne(chat.character_id);
    if (!character) throw new NotFoundException('Character not found');

    if (!body.provider || !body.model) {
      throw new BadRequestException('provider and model are required');
    }

    const generationType = body.type ?? 'normal';
    const customPromptChars =
      body.customPrompts?.reduce((sum, prompt) => sum + (prompt.content?.length ?? 0), 0) ?? 0;
    this.chatDebug('generate.start', {
      requestTag,
      chatId,
      generationType,
      provider: body.provider,
      model: body.model,
      messageLength: body.message?.trim()?.length ?? 0,
      promptOrderCount: body.promptOrder?.length ?? 0,
      customPromptCount: body.customPrompts?.length ?? 0,
      customPromptChars,
    });
    const now = new Date().toISOString();

    if (generationType === 'normal' && body.message?.trim()) {
      await this.chatService.addMessage({
        chatId,
        role: 'user',
        content: body.message.trim(),
      });
    }

    let allMessages = await this.chatService.getMessages(chatId);
    this.chatDebug('generate.messages.loaded', {
      requestTag,
      chatId,
      messageCount: allMessages.length,
    });
    let targetAssistant: MessageRow | null = this.findLastAssistant(allMessages);
    let promptSource = allMessages;

    if ((generationType === 'regenerate' || generationType === 'swipe') && targetAssistant) {
      promptSource = allMessages.filter((msg) => msg.id !== targetAssistant!.id);
    }

    if (
      (generationType === 'regenerate' ||
        generationType === 'swipe' ||
        generationType === 'continue') &&
      !targetAssistant
    ) {
      throw new BadRequestException(
        `${generationType} requires an existing assistant message`,
      );
    }

    if (generationType === 'impersonate') {
      promptSource = [
        ...promptSource,
        {
          id: -1,
          chat_id: chatId,
          role: 'system',
          name: '',
          content:
            'Generate the next user message only. Write as the user in first person.',
          is_hidden: 0,
          swipe_id: 0,
          swipes: '[]',
          gen_started: null,
          gen_finished: null,
          extra: '{}',
          created_at: now,
        },
      ];
    }

    // RAG: retrieve relevant memories
    const ragSettings = await this.ragService.getSettings();
    let ragContext: RetrievedMemory[] = [];
    if (ragSettings.enabled) {
      ragContext = await this.ragService.retrieveMemories(
        promptSource,
        character.id,
        chatId,
        ragSettings,
      );
    }

    const promptMessages = this.promptBuilder.buildPrompt(
      character,
      chat,
      promptSource,
      {
        maxTokens: body.maxTokens,
        maxContext: body.maxContext,
        userName: body.userName ?? 'User',
        mergeSystemMessages: true,
        personaDescription: await this.getPersonaDescription(body.personaId, character.id),
        worldInfoSettings: {
          activatedEntries: await this.getActivatedEntries(
            body.worldInfoBookIds,
            promptSource,
            character,
          ),
        },
        ragContext,
        ragMaxTokenBudget: ragSettings.maxTokenBudget,
        ragInsertionPosition: ragSettings.insertionPosition,
        ragInsertionDepth: ragSettings.insertionDepth,
        promptOrder: body.promptOrder,
        customPrompts: body.customPrompts,
      },
    );
    this.chatDebug('generate.prompt.built', {
      requestTag,
      chatId,
      promptMessageCount: promptMessages.length,
    });

    const abortController = new AbortController();
    this.activeGenerations.set(chatId, abortController);
    res.on('close', () => {
      abortController.abort();
      this.activeGenerations.delete(chatId);
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Inject a cache-busting marker for swipe/regenerate to prevent identical responses
    if (generationType === 'swipe' || generationType === 'regenerate') {
      const seed = Math.random().toString(36).slice(2, 10);
      promptMessages.push({
        role: 'system',
        content: `[generation_seed: ${seed}] Produce a fresh, unique response. Vary your word choices, structure, and creative details from any prior responses.`,
      });
    }

    const completionRequest: CompletionRequest = {
      ...body,
      messages: promptMessages,
      stream: true,
    };

    let fullContent = '';
    let fullReasoning = '';
    let chunkCount = 0;
    let reasoningChunkCount = 0;
    let structuredResult: unknown = null;
    try {
      if (body.structuredOutput) {
        // --- Structured output path: text stream + incremental JSON parsing ---
        promptMessages.push({
          role: 'system',
          content: getStructuredOutputSystemPrompt(),
        });

        // Google native SDK requires all system messages at the beginning.
        // Merge any system messages scattered in the prompt to the front.
        this.hoistSystemMessages(promptMessages);

        for await (const chunk of this.aiProviderService.streamStructured(
          completionRequest,
          StructuredResponseSchema,
          abortController.signal,
        )) {
          // Normalize: bare array → {blocks: [...]}
          const partial = Array.isArray(chunk.partial)
            ? { blocks: chunk.partial }
            : chunk.partial;
          structuredResult = partial;
          chunkCount += 1;
          if (chunkCount <= 3 || chunkCount % 20 === 0) {
            this.chatDebug('generate.structuredChunk', {
              requestTag,
              chatId,
              chunkCount,
            });
          }
          res.write(`data: ${JSON.stringify({ structured: partial })}\n\n`);
        }

        this.logger.log(`[structured] Stream ended. Total chunks: ${chunkCount}`);

        // Extract text for persistence and RAG
        if (structuredResult && typeof structuredResult === 'object') {
          // Normalize: if model returned a bare array, wrap it in {blocks: [...]}
          const normalized = Array.isArray(structuredResult)
            ? { blocks: structuredResult }
            : structuredResult;
          try {
            const parsed = StructuredResponseSchema.parse(normalized);
            fullContent = JSON.stringify(parsed);
            // Extract narration for RAG embedding
            const narrationText = extractNarrationText(parsed);
            if (!narrationText) fullContent = JSON.stringify(parsed);
          } catch {
            fullContent = JSON.stringify(normalized);
          }
        }
      } else {
        // --- Text streaming path (existing behavior) ---
        for await (const chunk of this.aiProviderService.streamComplete(
        completionRequest,
        abortController.signal,
      )) {
        if (chunk.content) {
          fullContent += chunk.content;
          chunkCount += 1;
          if (chunkCount <= 3 || chunkCount % 20 === 0) {
            this.chatDebug('generate.chunk', {
              requestTag,
              chatId,
              chunkCount,
              aggregatedLength: fullContent.length,
            });
          }
          res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
        }

        if (chunk.reasoning) {
          fullReasoning += chunk.reasoning;
          reasoningChunkCount += 1;
          if (reasoningChunkCount <= 3 || reasoningChunkCount % 20 === 0) {
            this.chatDebug('generate.reasoningChunk', {
              requestTag,
              chatId,
              reasoningChunkCount,
              aggregatedReasoningLength: fullReasoning.length,
            });
          }
          res.write(`data: ${JSON.stringify({ reasoning: chunk.reasoning })}\n\n`);
        }
      }
      } // end else (text streaming path)

      if (!abortController.signal.aborted) {
        await this.persistGenerationResult(
          generationType,
          chatId,
          targetAssistant,
          fullContent,
          fullReasoning,
          now,
          body.structuredOutput ? 'structured' : undefined,
        );
        this.chatDebug('generate.persisted', {
          requestTag,
          chatId,
          generationType,
          finalContentLength: fullContent.length,
          finalReasoningLength: fullReasoning.length,
        });

        // RAG: embed new messages asynchronously (fire-and-forget)
        if (ragSettings.enabled && fullContent.trim()) {
          const latestMessages = await this.chatService.getMessages(chatId);
          const lastMsg = latestMessages[latestMessages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            this.ragService.onMessagePersisted(lastMsg, character.id, ragSettings);
          }
          // Also embed the user message if it was just added
          if (generationType === 'normal' && body.message?.trim()) {
            const userMsg = [...latestMessages].reverse().find(
              (m) => m.role === 'user' && m.content === body.message?.trim(),
            );
            if (userMsg) {
              this.ragService.onMessagePersisted(userMsg, character.id, ragSettings);
            }
          }
        }
      }

      res.write('data: [DONE]\n\n');
      this.chatDebug('generate.done', {
        requestTag,
        chatId,
        chunkCount,
        finalContentLength: fullContent.length,
        reasoningChunkCount,
        finalReasoningLength: fullReasoning.length,
      });
    } catch (error: unknown) {
      if (!abortController.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[generate] Error: ${message}`, error instanceof Error ? error.stack : '');
        this.chatDebug('generate.error', {
          requestTag,
          chatId,
          message,
        });
        res.write(`data: ${JSON.stringify({ error: `[ERROR] ${message}` })}\n\n`);
      } else {
        this.chatDebug('generate.aborted', { requestTag, chatId });
      }
    } finally {
      this.activeGenerations.delete(chatId);
      res.end();
    }
  }

  @Post('chat/:chatId/stop')
  stop(@Param('chatId', ParseIntPipe) chatId: number) {
    this.chatDebug('stop.request', { chatId });
    const controller = this.activeGenerations.get(chatId);
    if (!controller) return { stopped: false };
    controller.abort();
    this.activeGenerations.delete(chatId);
    return { stopped: true };
  }

  @Put('messages/:id/swipe')
  async swipe(
    @Param('id', ParseIntPipe) messageId: number,
    @Body() body: { direction?: 'left' | 'right'; swipeId?: number; content?: string },
  ) {
    const message = await this.chatService.findMessageById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    const swipes = this.parseSwipes(message);
    const appendedContent = Boolean(body.content?.trim());
    if (body.content?.trim()) {
      swipes.push(body.content.trim());
    }

    if (swipes.length === 0) {
      throw new BadRequestException('No swipes available');
    }

    let nextSwipeId = message.swipe_id ?? 0;
    if (typeof body.swipeId === 'number') {
      nextSwipeId = this.clamp(body.swipeId, 0, swipes.length - 1);
    } else if (body.direction === 'left') {
      nextSwipeId = nextSwipeId <= 0 ? swipes.length - 1 : nextSwipeId - 1;
    } else if (body.direction === 'right') {
      nextSwipeId = nextSwipeId >= swipes.length - 1 ? 0 : nextSwipeId + 1;
    } else if (appendedContent) {
      nextSwipeId = swipes.length - 1;
    }

    const extra = this.parseExtra(message.extra);
    const reasoningSwipes = this.parseReasoningSwipes(
      extra,
      swipes.length,
      message.swipe_id ?? 0,
    );
    const nextReasoning = reasoningSwipes[nextSwipeId] ?? '';
    const nextExtra = this.stringifyExtra(extra, nextReasoning, reasoningSwipes);

    const updated = await this.chatService.updateMessage(messageId, {
      swipeId: nextSwipeId,
      swipes: JSON.stringify(swipes),
      content: swipes[nextSwipeId] ?? message.content,
      extra: nextExtra,
    });

    return updated;
  }

  private async persistGenerationResult(
    generationType: GenerationType,
    chatId: number,
    targetAssistant: MessageRow | null,
    fullContent: string,
    fullReasoning: string,
    startedAt: string,
    format?: string,
  ) {
    const finishedAt = new Date().toISOString();
    if (!fullContent.trim()) return;
    const extraObj: Record<string, unknown> = {};
    if (format) extraObj.format = format;
    const messageExtra = fullReasoning
      ? this.stringifyExtra(extraObj, fullReasoning, [fullReasoning])
      : (Object.keys(extraObj).length > 0 ? JSON.stringify(extraObj) : '{}');

    if (generationType === 'impersonate') {
      await this.chatService.addMessage({
        chatId,
        role: 'user',
        content: fullContent,
        genStarted: startedAt,
        genFinished: finishedAt,
      });
      return;
    }

    if (generationType === 'continue' && targetAssistant) {
      // Continue should create a new assistant message instead of mutating history.
      await this.chatService.addMessage({
        chatId,
        role: 'assistant',
        name: targetAssistant.name || '',
        content: fullContent,
        swipes: JSON.stringify([fullContent]),
        genStarted: startedAt,
        genFinished: finishedAt,
        extra: messageExtra,
      });
      return;
    }

    if (generationType === 'regenerate' && targetAssistant) {
      // Regenerate should append a new assistant message to preserve history.
      await this.chatService.addMessage({
        chatId,
        role: 'assistant',
        name: targetAssistant.name || '',
        content: fullContent,
        swipes: JSON.stringify([fullContent]),
        genStarted: startedAt,
        genFinished: finishedAt,
        extra: messageExtra,
      });
      return;
    }

    if (generationType === 'swipe' && targetAssistant) {
      const swipes = this.parseSwipes(targetAssistant);
      swipes.push(fullContent);
      const nextSwipeId = swipes.length - 1;
      const existingExtra = this.parseExtra(targetAssistant.extra);
      const reasoningSwipes = this.parseReasoningSwipes(
        existingExtra,
        swipes.length,
        targetAssistant.swipe_id ?? 0,
      );
      reasoningSwipes[nextSwipeId] = fullReasoning;
      await this.chatService.updateMessage(targetAssistant.id, {
        content: fullContent,
        swipeId: nextSwipeId,
        swipes: JSON.stringify(swipes),
        genStarted: startedAt,
        genFinished: finishedAt,
        extra: this.stringifyExtra(existingExtra, fullReasoning, reasoningSwipes),
      });
      return;
    }

    await this.chatService.addMessage({
      chatId,
      role: 'assistant',
      content: fullContent,
      swipes: JSON.stringify([fullContent]),
      genStarted: startedAt,
      genFinished: finishedAt,
      extra: messageExtra,
    });
  }

  private findLastAssistant(messages: MessageRow[]): MessageRow | null {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }

  /** Move all system messages to the front and merge into a single message. */
  private hoistSystemMessages(messages: ChatMessage[]): void {
    const systemParts: string[] = [];
    let i = 0;
    while (i < messages.length) {
      if (messages[i].role === 'system') {
        const content = messages[i].content;
        if (typeof content === 'string') systemParts.push(content);
        messages.splice(i, 1);
      } else {
        i++;
      }
    }
    if (systemParts.length > 0) {
      messages.unshift({ role: 'system', content: systemParts.join('\n\n') });
    }
  }

  private parseSwipes(message: MessageRow): string[] {
    const base = message.content ? [message.content] : [];
    try {
      const parsed = JSON.parse(message.swipes || '[]');
      if (!Array.isArray(parsed)) return base;
      const values = parsed.filter((item): item is string => typeof item === 'string');
      if (values.length === 0 && message.content) return base;
      return values;
    } catch {
      return base;
    }
  }

  private parseExtra(extra: string | null | undefined): Record<string, unknown> {
    if (!extra) return {};
    try {
      const parsed = JSON.parse(extra);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private parseReasoning(extra: Record<string, unknown>): string {
    return typeof extra.reasoning === 'string' ? extra.reasoning : '';
  }

  private parseReasoningSwipes(
    extra: Record<string, unknown>,
    swipeCount: number,
    currentSwipeId: number,
  ): string[] {
    const normalizedCount = Math.max(0, swipeCount);
    const parsed =
      Array.isArray(extra.reasoningSwipes)
        ? extra.reasoningSwipes.filter((item): item is string => typeof item === 'string')
        : [];

    if (parsed.length === 0) {
      const reasoning = this.parseReasoning(extra);
      if (!reasoning || normalizedCount === 0) return [];
      const fallback = Array.from({ length: normalizedCount }, () => '');
      const index = this.clamp(currentSwipeId, 0, normalizedCount - 1);
      fallback[index] = reasoning;
      return fallback;
    }

    if (normalizedCount === 0) return [];
    const swipes = parsed.slice(0, normalizedCount);
    while (swipes.length < normalizedCount) {
      swipes.push('');
    }
    return swipes;
  }

  private stringifyExtra(
    baseExtra: Record<string, unknown>,
    reasoning: string,
    reasoningSwipes: string[],
  ): string {
    const nextExtra: Record<string, unknown> = { ...baseExtra };
    if (reasoning) {
      nextExtra.reasoning = reasoning;
    } else {
      delete nextExtra.reasoning;
    }
    if (reasoningSwipes.length > 0) {
      nextExtra.reasoningSwipes = reasoningSwipes;
    } else {
      delete nextExtra.reasoningSwipes;
    }
    return JSON.stringify(nextExtra);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private async getPersonaDescription(
    personaId: string | undefined,
    characterId: number,
  ): Promise<string | undefined> {
    let persona = personaId
      ? await this.personaService.findOne(personaId)
      : null;

    // Try to find a persona connected to this character
    if (!persona) {
      const connected = await this.personaService.findForEntity(
        'character',
        String(characterId),
      );
      if (connected.length > 0) persona = connected[0];
    }

    // Fall back to default persona
    if (!persona) {
      persona = await this.personaService.getDefault();
    }

    return persona?.description || undefined;
  }

  private async getActivatedEntries(
    bookIds: number[] | undefined,
    messages: MessageRow[],
    character: { description: string; personality: string; scenario: string },
  ) {
    if (!bookIds || bookIds.length === 0) return [];

    const allEntries = [];
    for (const bookId of bookIds) {
      const entries = await this.worldInfoService.findEntries(bookId);
      allEntries.push(...entries);
    }

    if (allEntries.length === 0) return [];

    return this.worldInfoScanner.scan(allEntries, {
      chatMessages: messages.map((m) => m.content),
      characterDescription: character.description,
      characterPersonality: character.personality,
      scenario: character.scenario,
    });
  }
}
