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
        alternate_greetings TEXT DEFAULT '[]',
        creator TEXT DEFAULT '',
        creator_notes TEXT DEFAULT '',
        character_version TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        spec TEXT DEFAULT 'chara_card_v2',
        spec_version TEXT DEFAULT '2.0',
        extensions TEXT DEFAULT '{}',
        character_book TEXT DEFAULT NULL,
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
        gen_started TEXT,
        gen_finished TEXT,
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

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        folder_type TEXT DEFAULT 'NONE',
        sort_order INTEGER DEFAULT 0,
        color TEXT,
        color2 TEXT,
        is_hidden INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS entity_tags (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (entity_type, entity_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        position INTEGER DEFAULT 0,
        depth INTEGER DEFAULT 2,
        role INTEGER DEFAULT 0,
        lorebook_id INTEGER,
        title TEXT,
        is_default INTEGER DEFAULT 0,
        avatar_path TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS persona_connections (
        persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        PRIMARY KEY (persona_id, entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar_url TEXT,
        allow_self_responses INTEGER DEFAULT 0,
        activation_strategy INTEGER DEFAULT 0,
        generation_mode INTEGER DEFAULT 0,
        disabled_members TEXT DEFAULT '[]',
        fav INTEGER DEFAULT 0,
        current_chat_id INTEGER,
        auto_mode_delay INTEGER DEFAULT 5,
        join_prefix TEXT DEFAULT '',
        join_suffix TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        PRIMARY KEY (group_id, character_id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chats_character_id ON chats(character_id);
      CREATE INDEX IF NOT EXISTS idx_world_info_entries_book_id ON world_info_entries(book_id);
      CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_persona_connections ON persona_connections(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    `);

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
