import { Controller, Post, Body, Res, Get, Query } from '@nestjs/common';
import { Response } from 'express';
import { AiProviderService } from './ai-provider.service';
import {
  CompletionRequest,
  HealthCheckRequest,
  TestRequestPayload,
} from './types';

@Controller(['ai', 'ai-provider'])
export class AiProviderController {
  constructor(private readonly aiService: AiProviderService) {}

  @Post('complete')
  async complete(@Body() body: CompletionRequest) {
    return this.aiService.complete(body);
  }

  @Post('stream')
  async stream(@Body() body: CompletionRequest, @Res() res: Response) {
    await this.handleStream(body, res);
  }

  @Post('chat')
  async chat(@Body() body: CompletionRequest, @Res() res: Response) {
    if (body.stream) {
      await this.handleStream({ ...body, stream: true }, res);
      return;
    }

    try {
      const result = await this.aiService.complete({ ...body, stream: false });
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    }
  }

  @Post('tokenize')
  async tokenize(
    @Body() body: { text?: string; messages?: CompletionRequest['messages'] },
  ) {
    return this.aiService.tokenize(body);
  }

  @Get('models')
  async models(@Query('provider') provider?: string) {
    return this.aiService.getModels(provider);
  }

  @Post('health-check')
  async healthCheck(@Body() body: HealthCheckRequest) {
    return this.aiService.healthCheck(body);
  }

  @Get('models/discover')
  async discoverModels(
    @Query('provider') provider: string,
    @Query('baseUrl') baseUrl: string,
  ) {
    if (!provider || !baseUrl) {
      throw new Error('provider and baseUrl are required');
    }
    return this.aiService.discoverModels(provider, baseUrl);
  }

  @Post('test-request')
  async testRequest(@Body() body: TestRequestPayload) {
    return this.aiService.testRequest(body);
  }

  private async handleStream(body: CompletionRequest, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    try {
      for await (const chunk of this.aiService.streamComplete(body, abortController.signal)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `data: ${JSON.stringify({ error: `[ERROR] ${message}` })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}
