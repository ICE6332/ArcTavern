import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import fs from 'fs';
import path from 'path';
import { PersonaService } from './persona.service';

interface UploadedBinaryFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller('personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  private get avatarDir() {
    return path.resolve(process.cwd(), 'data', 'personas');
  }

  private ensureAvatarDir() {
    if (!fs.existsSync(this.avatarDir)) {
      fs.mkdirSync(this.avatarDir, { recursive: true });
    }
  }

  @Get()
  async findAll() {
    return this.personaService.findAll();
  }

  @Get('default')
  async getDefault() {
    return this.personaService.getDefault();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const persona = await this.personaService.findOne(id);
    if (!persona) throw new NotFoundException('Persona not found');
    return persona;
  }

  @Post()
  async create(@Body() body: {
    name: string;
    description?: string;
    position?: number;
    depth?: number;
    role?: number;
    lorebookId?: number;
    title?: string;
    isDefault?: boolean;
  }) {
    return this.personaService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const existing = await this.personaService.findOne(id);
    if (!existing) throw new NotFoundException('Persona not found');
    return this.personaService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.personaService.findOne(id);
    if (!existing) throw new NotFoundException('Persona not found');
    const avatarPath = path.join(this.avatarDir, `${id}.png`);
    if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
    return this.personaService.remove(id);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file?: UploadedBinaryFile) {
    const existing = await this.personaService.findOne(id);
    if (!existing) throw new NotFoundException('Persona not found');
    if (!file) throw new BadRequestException('Missing avatar file');

    this.ensureAvatarDir();
    const filePath = path.join(this.avatarDir, `${id}.png`);
    fs.writeFileSync(filePath, file.buffer);

    return this.personaService.update(id, { avatarPath: `/api/personas/${id}/avatar` });
  }

  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string) {
    const filePath = path.join(this.avatarDir, `${id}.png`);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Avatar not found');
    // Return will be handled by response
    return fs.readFileSync(filePath);
  }

  @Put(':id/connections')
  async updateConnections(
    @Param('id') id: string,
    @Body() body: { connections: Array<{ entityType: string; entityId: string }> },
  ) {
    const existing = await this.personaService.findOne(id);
    if (!existing) throw new NotFoundException('Persona not found');
    return this.personaService.updateConnections(id, body.connections);
  }

  @Get('for/:entityType/:entityId')
  async findForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.personaService.findForEntity(entityType, entityId);
  }
}
