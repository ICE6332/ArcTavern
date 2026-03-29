import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { VectorStoreService } from './vector-store.service';
import { RagEmbedderService } from './rag-embedder.service';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AiProviderModule, SettingsModule],
  controllers: [RagController],
  providers: [RagService, VectorStoreService, RagEmbedderService],
  exports: [RagService, VectorStoreService],
})
export class RagModule {}
