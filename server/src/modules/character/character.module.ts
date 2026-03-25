import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterCardParserService } from './character-card-parser.service';
import { WorldInfoModule } from '../world-info/world-info.module';

@Module({
  imports: [WorldInfoModule],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterCardParserService],
  exports: [CharacterService, CharacterCardParserService],
})
export class CharacterModule {}
