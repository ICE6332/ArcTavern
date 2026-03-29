import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { RagModule } from '../rag/rag.module';
import { SettingsModule } from '../settings/settings.module';
import { WorldInfoController } from './world-info.controller';
import { WorldInfoService } from './world-info.service';
import { WorldInfoScannerService } from './world-info-scanner.service';
import { WorldInfoVectorService } from './world-info-vector.service';

@Module({
  imports: [AiProviderModule, RagModule, SettingsModule],
  controllers: [WorldInfoController],
  providers: [WorldInfoService, WorldInfoScannerService, WorldInfoVectorService],
  exports: [WorldInfoService, WorldInfoScannerService, WorldInfoVectorService],
})
export class WorldInfoModule {}
