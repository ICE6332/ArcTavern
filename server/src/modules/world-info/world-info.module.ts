import { Module } from '@nestjs/common';
import { WorldInfoController } from './world-info.controller';
import { WorldInfoService } from './world-info.service';
import { WorldInfoScannerService } from './world-info-scanner.service';

@Module({
  controllers: [WorldInfoController],
  providers: [WorldInfoService, WorldInfoScannerService],
  exports: [WorldInfoService, WorldInfoScannerService],
})
export class WorldInfoModule {}
