import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface TagRow {
  id: string;
  name: string;
  folder_type: string;
  sort_order: number;
  color: string | null;
  color2: string | null;
  is_hidden: number;
  created_at: string;
}

export interface EntityTagRow {
  entity_type: string;
  entity_id: string;
  tag_id: string;
}

@Injectable()
export class TagService {
  constructor(private readonly db: DrizzleService) {}

  async findAll(): Promise<TagRow[]> {
    return this.db.query<TagRow>('SELECT * FROM tags ORDER BY sort_order ASC, name ASC');
  }

  async findOne(id: string): Promise<TagRow | null> {
    return this.db.get<TagRow>('SELECT * FROM tags WHERE id = ?', [id]);
  }

  async create(data: {
    id?: string;
    name: string;
    folderType?: string;
    sortOrder?: number;
    color?: string | null;
    color2?: string | null;
  }): Promise<TagRow> {
    const id = data.id || crypto.randomUUID();
    this.db.run(
      `INSERT INTO tags (id, name, folder_type, sort_order, color, color2)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.folderType ?? 'NONE',
        data.sortOrder ?? 0,
        data.color ?? null,
        data.color2 ?? null,
      ],
    );
    return (await this.findOne(id))!;
  }

  async update(id: string, data: Record<string, unknown>): Promise<TagRow | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      folderType: 'folder_type',
      sortOrder: 'sort_order',
      color: 'color',
      color2: 'color2',
      isHidden: 'is_hidden',
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
    if (sets.length === 0) return this.findOne(id);
    values.push(id);
    this.db.run(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  async remove(id: string): Promise<TagRow | null> {
    const tag = await this.findOne(id);
    if (tag) this.db.run('DELETE FROM tags WHERE id = ?', [id]);
    return tag;
  }

  async assignTag(entityType: string, entityId: string, tagId: string): Promise<void> {
    this.db.run(
      `INSERT OR IGNORE INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)`,
      [entityType, entityId, tagId],
    );
  }

  async unassignTag(entityType: string, entityId: string, tagId: string): Promise<void> {
    this.db.run(`DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ? AND tag_id = ?`, [
      entityType,
      entityId,
      tagId,
    ]);
  }

  async getEntityTags(entityType: string, entityId: string): Promise<TagRow[]> {
    return this.db.query<TagRow>(
      `SELECT t.* FROM tags t
       JOIN entity_tags et ON et.tag_id = t.id
       WHERE et.entity_type = ? AND et.entity_id = ?
       ORDER BY t.sort_order ASC, t.name ASC`,
      [entityType, entityId],
    );
  }

  async getEntitiesByTag(tagId: string, entityType?: string): Promise<EntityTagRow[]> {
    if (entityType) {
      return this.db.query<EntityTagRow>(
        'SELECT * FROM entity_tags WHERE tag_id = ? AND entity_type = ?',
        [tagId, entityType],
      );
    }
    return this.db.query<EntityTagRow>('SELECT * FROM entity_tags WHERE tag_id = ?', [tagId]);
  }
}
