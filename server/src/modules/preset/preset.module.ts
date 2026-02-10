import { Module } from '@nestjs/common';
import { PresetController } from './preset.controller';
import { PresetService } from './preset.service';

@Module({
  controllers: [PresetController],
  providers: [PresetService],
  exports: [PresetService],
})
export class PresetModule {}
