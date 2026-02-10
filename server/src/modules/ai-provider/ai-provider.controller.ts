import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiProviderService } from './ai-provider.service';
import { ChatService } from '../chat/chat.service';
import { CompletionRequest } from './types';

@Controller('ai')
export class AiProviderController {
  constructor(
    private readonly aiService: AiProviderService,
    private readonly chatService: ChatService,
  ) {}

  @Post('complete')
  async complete(@Body() body: CompletionRequest) {
    return this.aiService.complete(body);
  }

  @Post('stream')
  async stream(@Body() body: CompletionRequest, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of this.aiService.streamComplete(body)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      res.write(
        `data: ${JSON.stringify({ error: error.message ?? 'Unknown error' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Post('chat')
  async chat(
    @Body()
    body: CompletionRequest & { chatId?: number; saveToDB?: boolean },
    @Res() res: Response,
  ) {
    // Save user message if chatId provided
    if (body.chatId && body.saveToDB !== false) {
      const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        await this.chatService.addMessage({
          chatId: body.chatId,
          role: 'user',
          name: lastUserMsg.name ?? '',
          content: lastUserMsg.content,
        });
      }
    }

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let fullContent = '';
      try {
        for await (const chunk of this.aiService.streamComplete(body)) {
          fullContent += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
        res.write('data: [DONE]\n\n');

        // Save assistant message
        if (body.chatId && body.saveToDB !== false) {
          await this.chatService.addMessage({
            chatId: body.chatId,
            role: 'assistant',
            content: fullContent,
          });
        }
      } catch (error: any) {
        res.write(
          `data: ${JSON.stringify({ error: error.message ?? 'Unknown error' })}\n\n`,
        );
      } finally {
        res.end();
      }
    } else {
      try {
        const result = await this.aiService.complete(body);

        // Save assistant message
        if (body.chatId && body.saveToDB !== false) {
          await this.chatService.addMessage({
            chatId: body.chatId,
            role: 'assistant',
            content: result.content,
          });
        }

        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error.message ?? 'Unknown error' });
      }
    }
  }
}
