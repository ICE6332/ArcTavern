import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterCardParserService } from './character-card-parser.service';

@Module({
  controllers: [CharacterController],
  providers: [CharacterService, CharacterCardParserService],
  exports: [CharacterService, CharacterCardParserService],
})
export class CharacterModule {}
