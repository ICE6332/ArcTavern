import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { GroupTurnOrderService } from './group-turn-order.service';
import { CharacterModule } from '../character/character.module';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Module({
  imports: [CharacterModule, ChatModule, AiProviderModule],
  controllers: [GroupController],
  providers: [GroupService, GroupTurnOrderService],
  exports: [GroupService, GroupTurnOrderService],
})
export class GroupModule {}
