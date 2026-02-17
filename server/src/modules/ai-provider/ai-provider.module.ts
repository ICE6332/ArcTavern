import { Module } from '@nestjs/common';
import { AiProviderController } from './ai-provider.controller';
import { AiProviderService } from './ai-provider.service';
import { SecretModule } from '../secret/secret.module';

@Module({
  imports: [SecretModule],
  controllers: [AiProviderController],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiProviderModule {}
