import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface PresetRow {
  id: number; name: string; api_type: string; data: string;
  created_at: string; updated_at: string;
}

@Injectable()
export class PresetService {
  constructor(private readonly db: DrizzleService) {}

  async findAll(apiType?: string): Promise<PresetRow[]> {
    if (apiType) {
      return this.db.query<PresetRow>('SELECT * FROM presets WHERE api_type = ?', [apiType]);
    }
    return this.db.query<PresetRow>('SELECT * FROM presets');
  }

  async findOne(id: number): Promise<PresetRow | null> {
    return this.db.get<PresetRow>('SELECT * FROM presets WHERE id = ?', [id]);
  }

  async create(data: { name: string; apiType: string; data: string }): Promise<PresetRow> {
    const { lastId } = this.db.run(
      'INSERT INTO presets (name, api_type, data) VALUES (?, ?, ?)',
      [data.name, data.apiType, data.data],
    );
    return (await this.findOne(lastId))!;
  }

  async update(id: number, data: Record<string, unknown>): Promise<PresetRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const fieldMap: Record<string, string> = { name: 'name', apiType: 'api_type', data: 'data' };
    for (const [key, val] of Object.entries(data)) {
      const col = fieldMap[key];
      if (col) { sets.push(`${col} = ?`); values.push(val); }
    }
    if (sets.length === 0) return this.findOne(id);
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE presets SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  async remove(id: number): Promise<PresetRow | null> {
    const preset = await this.findOne(id);
    if (preset) this.db.run('DELETE FROM presets WHERE id = ?', [id]);
    return preset;
  }
}
