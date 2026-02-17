import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGenerationController } from './chat-generation.controller';
import { PromptBuilderService } from './prompt-builder.service';
import { CharacterModule } from '../character/character.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { WorldInfoModule } from '../world-info/world-info.module';
import { PersonaModule } from '../persona/persona.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [CharacterModule, AiProviderModule, WorldInfoModule, PersonaModule, RagModule],
  controllers: [ChatController, ChatGenerationController],
  providers: [ChatService, PromptBuilderService],
  exports: [ChatService, PromptBuilderService],
})
export class ChatModule {}
