import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { SCHEMA_DDL } from './schema-ddl';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private sqlite!: SqlJsDatabase;
  private dbPath!: string;
  private saveInterval!: ReturnType<typeof setInterval>;

  async onModuleInit() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'arctravern.db');
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.sqlite = new SQL.Database(buffer);
    } else {
      this.sqlite = new SQL.Database();
    }

    this.sqlite.run('PRAGMA foreign_keys = ON');
    this.createTables();
    this.saveToDisk();

    // Auto-save every 30 seconds
    this.saveInterval = setInterval(() => this.saveToDisk(), 30_000);
  }

  private createTables() {
    this.sqlite.run(SCHEMA_DDL);

    this.ensureSchemaMigrations();
  }

  private ensureSchemaMigrations() {
    this.ensureColumns('characters', [
      ['alternate_greetings', "TEXT DEFAULT '[]'"],
      ['character_version', "TEXT DEFAULT ''"],
      ['character_book', 'TEXT DEFAULT NULL'],
    ]);

    this.ensureColumns('messages', [
      ['swipes', "TEXT DEFAULT '[]'"],
      ['swipe_id', 'INTEGER DEFAULT 0'],
      ['gen_started', 'TEXT'],
      ['gen_finished', 'TEXT'],
      ['extra', "TEXT DEFAULT '{}'"],
    ]);

    this.ensureColumns('characters', [
      ['world_info_book_id', 'INTEGER DEFAULT NULL'],
    ]);

    this.ensureColumns('chats', [
      ['group_id', 'TEXT'],
    ]);

    this.ensureColumns('presets', [
      ['is_default', 'INTEGER DEFAULT 0'],
      ['source_hash', 'TEXT DEFAULT NULL'],
    ]);

    // Unique index for preset name + api_type
    try {
      this.sqlite.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_name_type ON presets(name, api_type)');
    } catch {
      // Index may already exist
    }

    this.ensureColumns('world_info_entries', [
      ['constant', 'INTEGER DEFAULT 0'],
      ['selective', 'INTEGER DEFAULT 0'],
      ['select_logic', 'INTEGER DEFAULT 0'],
      ['order', 'INTEGER DEFAULT 100'],
      ['exclude_recursion', 'INTEGER DEFAULT 0'],
      ['prevent_recursion', 'INTEGER DEFAULT 0'],
      ['probability', 'INTEGER DEFAULT 100'],
      ['use_probability', 'INTEGER DEFAULT 1'],
      ['depth', 'INTEGER DEFAULT 4'],
      ['group_name', "TEXT DEFAULT ''"],
      ['group_override', 'INTEGER DEFAULT 0'],
      ['group_weight', 'INTEGER DEFAULT 100'],
      ['scan_depth', 'INTEGER DEFAULT 0'],
      ['match_whole_words', 'INTEGER DEFAULT 0'],
      ['use_group_scoring', 'INTEGER DEFAULT 0'],
      ['automation_id', "TEXT DEFAULT ''"],
      ['role', 'INTEGER DEFAULT 0'],
      ['sticky', 'INTEGER DEFAULT 0'],
      ['cooldown', 'INTEGER DEFAULT 0'],
      ['delay', 'INTEGER DEFAULT 0'],
      ['triggers', "TEXT DEFAULT '[]'"],
    ]);
  }

  private quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private ensureColumns(table: string, columns: Array<[string, string]>) {
    const quotedTable = this.quoteIdentifier(table);
    const rows = this.query<{ name: string }>(`PRAGMA table_info(${quotedTable})`);
    const existing = new Set(rows.map((r) => r.name));
    for (const [name, definition] of columns) {
      if (!existing.has(name)) {
        const quotedColumn = this.quoteIdentifier(name);
        this.sqlite.run(
          `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} ${definition}`,
        );
      }
    }
  }

  /** Run a query that returns rows */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.sqlite.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /** Run a statement (INSERT/UPDATE/DELETE) and return info */
  run(sql: string, params: unknown[] = []): { changes: number; lastId: number } {
    this.sqlite.run(sql, params);
    const changes = this.sqlite.getRowsModified();
    const lastIdResult = this.query<{ id: number }>('SELECT last_insert_rowid() as id');
    const lastId = lastIdResult[0]?.id ?? 0;
    this.saveToDisk();
    return { changes, lastId };
  }

  /** Get a single row */
  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results[0] ?? null;
  }

  private saveToDisk() {
    try {
      const data = this.sqlite.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  onModuleDestroy() {
    clearInterval(this.saveInterval);
    this.saveToDisk();
    this.sqlite?.close();
  }
}
