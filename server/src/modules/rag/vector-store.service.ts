import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';
import type { VectorRecord } from './types';

type LanceRecord = Record<string, unknown>;

function toRecords(items: VectorRecord[]): LanceRecord[] {
  return items.map((item) => ({ ...item }) as LanceRecord);
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private db!: lancedb.Connection;
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly DB_PATH = path.resolve(__dirname, '../../../../data/lancedb');

  async onModuleInit() {
    if (!fs.existsSync(this.DB_PATH)) {
      fs.mkdirSync(this.DB_PATH, { recursive: true });
    }
    this.db = await lancedb.connect(this.DB_PATH);
    this.logger.log(`LanceDB connected at ${this.DB_PATH}`);
  }

  private tableName(dimensions: number): string {
    return `memories_${dimensions}d`;
  }

  async getTable(dimensions: number): Promise<lancedb.Table> {
    const name = this.tableName(dimensions);
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(name)) {
      return this.db.openTable(name);
    }
    // Create with a seed record then delete it
    const seed: LanceRecord = {
      id: '__seed__',
      messageId: -1,
      chatId: -1,
      characterId: -1,
      role: 'system',
      name: '',
      content: '',
      vector: new Array(dimensions).fill(0),
      createdAt: new Date().toISOString(),
      chunkIndex: 0,
    };
    const table = await this.db.createTable(name, [seed]);
    await table.delete("id = '__seed__'");
    return table;
  }

  async addRecords(records: VectorRecord[], dimensions: number): Promise<void> {
    if (records.length === 0) return;
    const table = await this.getTable(dimensions);
    await table.add(toRecords(records));
  }

  async search(
    queryVector: number[],
    dimensions: number,
    filter: string,
    limit: number,
  ): Promise<Array<VectorRecord & { _distance: number }>> {
    const table = await this.getTable(dimensions);
    const query = table.search(queryVector).where(filter).limit(limit);
    // distanceType is available on VectorQuery
    if ('distanceType' in query && typeof query.distanceType === 'function') {
      (query as any).distanceType('cosine');
    }
    const results = await query.toArray();
    return results as unknown as Array<VectorRecord & { _distance: number }>;
  }

  async deleteByMessageId(messageId: number, dimensions: number): Promise<void> {
    const table = await this.getTable(dimensions);
    await table.delete(`messageId = ${messageId}`);
  }

  async deleteByChatId(chatId: number, dimensions: number): Promise<void> {
    const table = await this.getTable(dimensions);
    await table.delete(`chatId = ${chatId}`);
  }

  async deleteByCharacterId(characterId: number, dimensions: number): Promise<void> {
    const table = await this.getTable(dimensions);
    await table.delete(`characterId = ${characterId}`);
  }

  async tableExists(dimensions: number): Promise<boolean> {
    const tableNames = await this.db.tableNames();
    return tableNames.includes(this.tableName(dimensions));
  }
}
