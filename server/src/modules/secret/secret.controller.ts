import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { SecretService } from './secret.service';

@Controller('secrets')
export class SecretController {
  constructor(private readonly secretService: SecretService) {}

  @Get()
  async listKeys() {
    return this.secretService.listKeys();
  }

  @Post()
  async set(@Body() body: { key: string; value: string }) {
    await this.secretService.set(body.key, body.value);
    return { success: true };
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.secretService.remove(key);
    return { success: true };
  }
}
