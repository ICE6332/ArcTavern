import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private sqlite!: SqlJsDatabase;
  private dbPath!: string;
  private saveInterval!: ReturnType<typeof setInterval>;

  async onModuleInit() {
    const dataDir = path.resolve(process.cwd(), 'data');
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
    this.sqlite.run(`
      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        avatar TEXT,
        description TEXT DEFAULT '',
        personality TEXT DEFAULT '',
        first_mes TEXT DEFAULT '',
        mes_example TEXT DEFAULT '',
        scenario TEXT DEFAULT '',
        system_prompt TEXT DEFAULT '',
        post_history_instructions TEXT DEFAULT '',
        creator TEXT DEFAULT '',
        creator_notes TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        spec TEXT DEFAULT 'chara_card_v2',
        spec_version TEXT DEFAULT '2.0',
        extensions TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        name TEXT DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        is_hidden INTEGER DEFAULT 0,
        swipe_id INTEGER DEFAULT 0,
        swipes TEXT DEFAULT '[]',
        extra TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_type TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS world_info_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS world_info_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        uid INTEGER NOT NULL,
        keys TEXT DEFAULT '[]',
        secondary_keys TEXT DEFAULT '[]',
        content TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        enabled INTEGER DEFAULT 1,
        insertion_order INTEGER DEFAULT 100,
        case_sensitive INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 10,
        position TEXT DEFAULT 'before_char',
        extensions TEXT DEFAULT '{}',
        FOREIGN KEY (book_id) REFERENCES world_info_books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS groups_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        members TEXT DEFAULT '[]',
        activation_strategy TEXT DEFAULT 'natural_order',
        allow_self_responses INTEGER DEFAULT 0,
        chat_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chats_character_id ON chats(character_id);
      CREATE INDEX IF NOT EXISTS idx_world_info_entries_book_id ON world_info_entries(book_id);
    `);
  }

  /** Run a query that returns rows */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.sqlite.prepare(sql);
    stmt.bind(params as any[]);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  /** Run a statement (INSERT/UPDATE/DELETE) and return info */
  run(sql: string, params: unknown[] = []): { changes: number; lastId: number } {
    this.sqlite.run(sql, params as any[]);
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
