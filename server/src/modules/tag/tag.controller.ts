import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { TagService } from './tag.service';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  async findAll() {
    return this.tagService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const tag = await this.tagService.findOne(id);
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  @Post()
  async create(@Body() body: { name: string; folderType?: string; sortOrder?: number; color?: string; color2?: string }) {
    return this.tagService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const existing = await this.tagService.findOne(id);
    if (!existing) throw new NotFoundException('Tag not found');
    return this.tagService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.tagService.findOne(id);
    if (!existing) throw new NotFoundException('Tag not found');
    return this.tagService.remove(id);
  }

  @Post('assign')
  async assignTag(@Body() body: { entityType: string; entityId: string; tagId: string }) {
    await this.tagService.assignTag(body.entityType, body.entityId, body.tagId);
    return { success: true };
  }

  @Delete('unassign')
  async unassignTag(@Body() body: { entityType: string; entityId: string; tagId: string }) {
    await this.tagService.unassignTag(body.entityType, body.entityId, body.tagId);
    return { success: true };
  }

  @Get('entity/:entityType/:entityId')
  async getEntityTags(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.tagService.getEntityTags(entityType, entityId);
  }
}
