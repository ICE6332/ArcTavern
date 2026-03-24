import { Module } from '@nestjs/common';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { LocalEmbeddingService } from './local-embedding.service';
import { LocalEmbeddingController } from './local-embedding.controller';
import { SecretModule } from '../secret/secret.module';

@Module({
  imports: [SecretModule],
  controllers: [AiProviderController, LocalEmbeddingController],
  providers: [AiProviderService, LocalEmbeddingService],
  exports: [AiProviderService, LocalEmbeddingService],
})
export class AiProviderModule {}
