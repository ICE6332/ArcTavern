import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
  Res,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorldInfoService, type WorldInfoEntryRow } from './world-info.service';
import { WorldInfoVectorService, type WIEmbeddingSettings } from './world-info-vector.service';

@Controller('world-info')
export class WorldInfoController {
  private readonly logger = new Logger(WorldInfoController.name);

  constructor(
    private readonly worldInfoService: WorldInfoService,
    private readonly worldInfoVectorService: WorldInfoVectorService,
  ) {}

  @Get()
  async findAllBooks() {
    return this.worldInfoService.findAllBooks();
  }

  @Get('settings/embedding')
  async getEmbeddingSettings() {
    return this.worldInfoVectorService.getSettings();
  }

  @Put('settings/embedding')
  async saveEmbeddingSettings(@Body() body: Partial<WIEmbeddingSettings>) {
    return this.worldInfoVectorService.saveSettings(body);
  }

  @Get(':id')
  async findBook(@Param('id', ParseIntPipe) id: number) {
    const book = await this.worldInfoService.findBook(id);
    if (!book) throw new NotFoundException('World info book not found');
    const entries = await this.worldInfoService.findEntries(id);
    return { ...book, entries };
  }

  @Post()
  async createBook(@Body() body: { name: string; description?: string }) {
    return this.worldInfoService.createBook(body);
  }

  @Put(':id')
  async updateBook(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    const existing = await this.worldInfoService.findBook(id);
    if (!existing) throw new NotFoundException('World info book not found');
    return this.worldInfoService.updateBook(id, body);
  }

  @Delete(':id')
  async deleteBook(@Param('id', ParseIntPipe) id: number) {
    const existing = await this.worldInfoService.findBook(id);
    if (!existing) throw new NotFoundException('World info book not found');
    await this.worldInfoVectorService.deleteBookVectors(id);
    return this.worldInfoService.deleteBook(id);
  }

  @Post(':id/vectorize')
  async vectorizeBook(@Param('id', ParseIntPipe) bookId: number) {
    const book = await this.worldInfoService.findBook(bookId);
    if (!book) throw new NotFoundException('World info book not found');
    const settings = await this.worldInfoVectorService.getSettings();
    const embedded = await this.worldInfoVectorService.embedBook(bookId, settings);
    return { ok: true, embedded };
  }

  @Post(':id/entries')
  async createEntry(
    @Param('id', ParseIntPipe) bookId: number,
    @Body() body: Record<string, unknown>,
  ) {
    const book = await this.worldInfoService.findBook(bookId);
    if (!book) throw new NotFoundException('World info book not found');
    const created = await this.worldInfoService.createEntry(bookId, body);
    if (created.vectorized) {
      this.scheduleVectorEmbed(created);
    }
    return created;
  }

  @Put('entries/:entryId')
  async updateEntry(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() body: Record<string, unknown>,
  ) {
    const existing = await this.worldInfoService.findEntry(entryId);
    if (!existing) throw new NotFoundException('World info entry not found');
    const updated = await this.worldInfoService.updateEntry(entryId, body);
    if (!updated) throw new NotFoundException('World info entry not found');
    if (updated.vectorized) {
      this.scheduleVectorEmbed(updated);
    } else if (existing.vectorized && !updated.vectorized) {
      void this.worldInfoVectorService.deleteEntryVectors(entryId);
    }
    return updated;
  }

  @Delete('entries/:entryId')
  async deleteEntry(@Param('entryId', ParseIntPipe) entryId: number) {
    const existing = await this.worldInfoService.findEntry(entryId);
    if (!existing) throw new NotFoundException('World info entry not found');
    const removed = await this.worldInfoService.deleteEntry(entryId);
    void this.worldInfoVectorService.deleteEntryVectors(entryId);
    return removed;
  }

  private scheduleVectorEmbed(entry: WorldInfoEntryRow) {
    void (async () => {
      try {
        const settings = await this.worldInfoVectorService.getSettings();
        await this.worldInfoVectorService.embedEntry(entry, settings);
      } catch (err) {
        this.logger.warn(`World info vector embed failed for entry ${entry.id}`, err);
      }
    })();
  }

  /**
   * Import from JSON body — accepts ST standalone, ArcTavern array, or character_book format.
   */
  @Post('import')
  async importBook(@Body() body: unknown) {
    return this.worldInfoService.importBook(body);
  }

  /**
   * Import from uploaded .json file — supports ST lorebook files directly.
   */
  @Post('import/file')
  @UseInterceptors(FileInterceptor('file'))
  async importBookFromFile(
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON file');
    }
    // Use filename (without extension) as fallback name
    const fallbackName = file.originalname.replace(/\.json$/i, '') || 'Imported Lorebook';
    const data =
      parsed && typeof parsed === 'object'
        ? { name: fallbackName, ...parsed }
        : { name: fallbackName };
    return this.worldInfoService.importBook(data);
  }

  @Get(':id/export')
  async exportBook(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const result = await this.worldInfoService.exportBook(id);
    if (!result) throw new NotFoundException('World info book not found');

    const fileName = result.book.name.replace(/[^\w.-]+/g, '_') || `lorebook-${id}`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`);
    res.send(JSON.stringify(result, null, 2));
  }
}
