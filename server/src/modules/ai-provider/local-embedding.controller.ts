import { Controller, Get, Post } from '@nestjs/common';
import { LocalEmbeddingService } from './local-embedding.service';

@Controller('api/embedding/local')
export class LocalEmbeddingController {
  constructor(private readonly localEmbedding: LocalEmbeddingService) {}

  @Get('status')
  getStatus() {
    return this.localEmbedding.getStatus();
  }

  @Post('download')
  async download() {
    await this.localEmbedding.downloadModel();
    return { success: true };
  }
}
