import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DrizzleService) {}

  async get(key: string): Promise<unknown> {
    const row = this.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  async set(key: string, value: unknown) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const existing = this.db.get('SELECT id FROM settings WHERE key = ?', [key]);
    if (existing) {
      this.db.run("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [
        serialized,
        key,
      ]);
    } else {
      this.db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, serialized]);
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
}
