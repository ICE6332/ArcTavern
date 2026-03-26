import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface WorldInfoBookRow {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface WorldInfoEntryRow {
  id: number;
  book_id: number;
  uid: number;
  keys: string;
  secondary_keys: string;
  content: string;
  comment: string;
  enabled: number;
  insertion_order: number;
  case_sensitive: number;
  priority: number;
  position: string;
  extensions: string;
  constant: number;
  selective: number;
  select_logic: number;
  order: number;
  exclude_recursion: number;
  prevent_recursion: number;
  probability: number;
  use_probability: number;
  depth: number;
  group_name: string;
  group_override: number;
  group_weight: number;
  scan_depth: number;
  match_whole_words: number;
  use_group_scoring: number;
  automation_id: string;
  role: number;
  sticky: number;
  cooldown: number;
  delay: number;
  triggers: string;
}

@Injectable()
export class WorldInfoService {
  constructor(private readonly db: DrizzleService) {}

  async findAllBooks(): Promise<WorldInfoBookRow[]> {
    return this.db.query<WorldInfoBookRow>('SELECT * FROM world_info_books ORDER BY name ASC');
  }

  async findBook(id: number): Promise<WorldInfoBookRow | null> {
    return this.db.get<WorldInfoBookRow>('SELECT * FROM world_info_books WHERE id = ?', [id]);
  }

  async createBook(data: { name: string; description?: string }): Promise<WorldInfoBookRow> {
    const { lastId } = this.db.run(
      'INSERT INTO world_info_books (name, description) VALUES (?, ?)',
      [data.name, data.description ?? ''],
    );
    return (await this.findBook(lastId))!;
  }

  async updateBook(id: number, data: Record<string, unknown>): Promise<WorldInfoBookRow | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      const col = fieldMap[key];
      if (col) {
        sets.push(`${col} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return this.findBook(id);
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE world_info_books SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findBook(id);
  }

  async deleteBook(id: number): Promise<WorldInfoBookRow | null> {
    const book = await this.findBook(id);
    if (book) this.db.run('DELETE FROM world_info_books WHERE id = ?', [id]);
    return book;
  }

  async findEntries(bookId: number): Promise<WorldInfoEntryRow[]> {
    return this.db.query<WorldInfoEntryRow>(
      'SELECT * FROM world_info_entries WHERE book_id = ? ORDER BY insertion_order ASC',
      [bookId],
    );
  }

  async findEntry(id: number): Promise<WorldInfoEntryRow | null> {
    return this.db.get<WorldInfoEntryRow>('SELECT * FROM world_info_entries WHERE id = ?', [id]);
  }

  async createEntry(bookId: number, data: Record<string, unknown>): Promise<WorldInfoEntryRow> {
    const maxUid = this.db.get<{ max_uid: number }>(
      'SELECT COALESCE(MAX(uid), 0) as max_uid FROM world_info_entries WHERE book_id = ?',
      [bookId],
    );
    const uid = (maxUid?.max_uid ?? 0) + 1;

    const { lastId } = this.db.run(
      `INSERT INTO world_info_entries (
        book_id, uid, keys, secondary_keys, content, comment, enabled, insertion_order,
        case_sensitive, priority, position, extensions, constant, selective, select_logic,
        "order", exclude_recursion, prevent_recursion, probability, use_probability,
        depth, group_name, group_override, group_weight, scan_depth, match_whole_words,
        use_group_scoring, automation_id, role, sticky, cooldown, delay, triggers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookId,
        uid,
        data.keys ?? '[]',
        data.secondary_keys ?? '[]',
        data.content ?? '',
        data.comment ?? '',
        data.enabled ?? 1,
        data.insertion_order ?? 100,
        data.case_sensitive ?? 0,
        data.priority ?? 10,
        data.position ?? 'before_char',
        data.extensions ?? '{}',
        data.constant ?? 0,
        data.selective ?? 0,
        data.select_logic ?? 0,
        data.order ?? 100,
        data.exclude_recursion ?? 0,
        data.prevent_recursion ?? 0,
        data.probability ?? 100,
        data.use_probability ?? 1,
        data.depth ?? 4,
        data.group_name ?? '',
        data.group_override ?? 0,
        data.group_weight ?? 100,
        data.scan_depth ?? 0,
        data.match_whole_words ?? 0,
        data.use_group_scoring ?? 0,
        data.automation_id ?? '',
        data.role ?? 0,
        data.sticky ?? 0,
        data.cooldown ?? 0,
        data.delay ?? 0,
        data.triggers ?? '[]',
      ],
    );
    return (await this.findEntry(lastId))!;
  }

  async updateEntry(id: number, data: Record<string, unknown>): Promise<WorldInfoEntryRow | null> {
    const fieldMap: Record<string, string> = {
      keys: 'keys',
      secondaryKeys: 'secondary_keys',
      content: 'content',
      comment: 'comment',
      enabled: 'enabled',
      insertionOrder: 'insertion_order',
      caseSensitive: 'case_sensitive',
      priority: 'priority',
      position: 'position',
      extensions: 'extensions',
      constant: 'constant',
      selective: 'selective',
      selectLogic: 'select_logic',
      order: '"order"',
      excludeRecursion: 'exclude_recursion',
      preventRecursion: 'prevent_recursion',
      probability: 'probability',
      useProbability: 'use_probability',
      depth: 'depth',
      groupName: 'group_name',
      groupOverride: 'group_override',
      groupWeight: 'group_weight',
      scanDepth: 'scan_depth',
      matchWholeWords: 'match_whole_words',
      useGroupScoring: 'use_group_scoring',
      automationId: 'automation_id',
      role: 'role',
      sticky: 'sticky',
      cooldown: 'cooldown',
      delay: 'delay',
      triggers: 'triggers',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      const col = fieldMap[key];
      if (col) {
        sets.push(`${col} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return this.findEntry(id);
    values.push(id);
    this.db.run(`UPDATE world_info_entries SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findEntry(id);
  }

  async deleteEntry(id: number): Promise<WorldInfoEntryRow | null> {
    const entry = await this.findEntry(id);
    if (entry) this.db.run('DELETE FROM world_info_entries WHERE id = ?', [id]);
    return entry;
  }

  async importBook(data: {
    name: string;
    description?: string;
    entries: Array<Record<string, unknown>>;
  }): Promise<WorldInfoBookRow> {
    const book = await this.createBook({ name: data.name, description: data.description });
    for (const entry of data.entries) {
      await this.createEntry(book.id, entry);
    }
    return book;
  }

  async exportBook(
    id: number,
  ): Promise<{ book: WorldInfoBookRow; entries: WorldInfoEntryRow[] } | null> {
    const book = await this.findBook(id);
    if (!book) return null;
    const entries = await this.findEntries(id);
    return { book, entries };
  }
}
