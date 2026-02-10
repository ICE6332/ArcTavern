import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DrizzleModule } from './db/drizzle.module';
import { CharacterModule } from './modules/character/character.module';
import { ChatModule } from './modules/chat/chat.module';
import { SecretModule } from './modules/secret/secret.module';
import { PresetModule } from './modules/preset/preset.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AiProviderModule } from './modules/ai-provider/ai-provider.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    CharacterModule,
    ChatModule,
    SecretModule,
    PresetModule,
    SettingsModule,
    AiProviderModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
