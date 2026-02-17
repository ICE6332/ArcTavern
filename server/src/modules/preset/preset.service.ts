import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';
import { loadDefaultPresets } from './default-presets';

export interface PresetRow {
  id: number;
  name: string;
  api_type: string;
  data: string;
  is_default: number;
  source_hash: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PresetService implements OnModuleInit {
  constructor(private readonly db: DrizzleService) {}

  async onModuleInit() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const defaults = loadDefaultPresets();
    for (const preset of defaults) {
      const existing = this.findByNameAndType(preset.name, preset.apiType);
      if (!existing) {
        this.db.run(
          'INSERT INTO presets (name, api_type, data, is_default, source_hash) VALUES (?, ?, ?, 1, ?)',
          [preset.name, preset.apiType, preset.data, preset.hash],
        );
      }
    }
  }

  findAll(apiType?: string): PresetRow[] {
    if (apiType) {
      return this.db.query<PresetRow>(
        'SELECT * FROM presets WHERE api_type = ? ORDER BY is_default DESC, name ASC',
        [apiType],
      );
    }
    return this.db.query<PresetRow>(
      'SELECT * FROM presets ORDER BY api_type, is_default DESC, name ASC',
    );
  }

  findOne(id: number): PresetRow | null {
    return this.db.get<PresetRow>('SELECT * FROM presets WHERE id = ?', [id]);
  }

  findByNameAndType(name: string, apiType: string): PresetRow | null {
    return this.db.get<PresetRow>(
      'SELECT * FROM presets WHERE name = ? AND api_type = ?',
      [name, apiType],
    );
  }

  create(data: { name: string; apiType: string; data: string }): PresetRow {
    const { lastId } = this.db.run(
      'INSERT INTO presets (name, api_type, data) VALUES (?, ?, ?)',
      [data.name, data.apiType, data.data],
    );
    return this.findOne(lastId)!;
  }

  update(id: number, data: Record<string, unknown>): PresetRow | null {
    const existing = this.findOne(id);
    if (!existing) return null;

    const sets: string[] = [];
    const values: unknown[] = [];
    const fieldMap: Record<string, string> = {
      name: 'name',
      apiType: 'api_type',
      data: 'data',
    };

    for (const [key, val] of Object.entries(data)) {
      const col = fieldMap[key];
      if (col) {
        sets.push(`${col} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return existing;

    // Clear source_hash when modifying a default preset
    if (existing.is_default) {
      sets.push('source_hash = NULL');
    }

    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE presets SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  remove(id: number): PresetRow | null {
    const preset = this.findOne(id);
    if (!preset) return null;
    if (preset.is_default) {
      throw new BadRequestException(
        'Cannot delete default preset. Use restore instead.',
      );
    }
    this.db.run('DELETE FROM presets WHERE id = ?', [id]);
    return preset;
  }

  /** Import a preset — stores the full JSON blob */
  importPreset(
    name: string,
    apiType: string,
    data: Record<string, unknown>,
  ): PresetRow {
    const existing = this.findByNameAndType(name, apiType);
    if (existing) {
      this.db.run(
        "UPDATE presets SET data = ?, updated_at = datetime('now') WHERE id = ?",
        [JSON.stringify(data), existing.id],
      );
      return this.findOne(existing.id)!;
    }
    return this.create({ name, apiType, data: JSON.stringify(data) });
  }

  /** Export a preset — returns parsed JSON data */
  exportPreset(
    id: number,
  ): { name: string; apiType: string; data: Record<string, unknown> } | null {
    const preset = this.findOne(id);
    if (!preset) return null;
    return {
      name: preset.name,
      apiType: preset.api_type,
      data: JSON.parse(preset.data),
    };
  }

  /** Restore a default preset to its original state */
  restore(id: number): { isDefault: boolean; preset: Record<string, unknown> } {
    const preset = this.findOne(id);
    if (!preset || !preset.is_default) {
      return { isDefault: false, preset: {} };
    }

    const defaults = loadDefaultPresets();
    const original = defaults.find(
      (d) => d.name === preset.name && d.apiType === preset.api_type,
    );

    if (!original) {
      return { isDefault: true, preset: {} };
    }

    this.db.run(
      "UPDATE presets SET data = ?, source_hash = ?, updated_at = datetime('now') WHERE id = ?",
      [original.data, original.hash, id],
    );

    return { isDefault: true, preset: JSON.parse(original.data) };
  }

  /** Get default preset names for a given api type */
  getDefaultNames(apiType: string): string[] {
    const rows = this.db.query<{ name: string }>(
      'SELECT name FROM presets WHERE api_type = ? AND is_default = 1 ORDER BY name',
      [apiType],
    );
    return rows.map((r) => r.name);
  }
}
