import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface PersonaRow {
  id: string;
  name: string;
  description: string;
  position: number;
  depth: number;
  role: number;
  lorebook_id: number | null;
  title: string | null;
  is_default: number;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaConnectionRow {
  persona_id: string;
  entity_type: string;
  entity_id: string;
}

@Injectable()
export class PersonaService {
  constructor(private readonly db: DrizzleService) {}

  async findAll(): Promise<PersonaRow[]> {
    return this.db.query<PersonaRow>('SELECT * FROM personas ORDER BY name ASC');
  }

  async findOne(id: string): Promise<PersonaRow | null> {
    return this.db.get<PersonaRow>('SELECT * FROM personas WHERE id = ?', [id]);
  }

  async create(data: {
    name: string;
    description?: string;
    position?: number;
    depth?: number;
    role?: number;
    lorebookId?: number | null;
    title?: string;
    isDefault?: boolean;
  }): Promise<PersonaRow> {
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO personas (id, name, description, position, depth, role, lorebook_id, title, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description ?? '',
        data.position ?? 0,
        data.depth ?? 2,
        data.role ?? 0,
        data.lorebookId ?? null,
        data.title ?? null,
        data.isDefault ? 1 : 0,
      ],
    );
    return (await this.findOne(id))!;
  }

  async update(id: string, data: Record<string, unknown>): Promise<PersonaRow | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      position: 'position',
      depth: 'depth',
      role: 'role',
      lorebookId: 'lorebook_id',
      title: 'title',
      isDefault: 'is_default',
      avatarPath: 'avatar_path',
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
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE personas SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  async remove(id: string): Promise<PersonaRow | null> {
    const persona = await this.findOne(id);
    if (persona) this.db.run('DELETE FROM personas WHERE id = ?', [id]);
    return persona;
  }

  async getConnections(personaId: string): Promise<PersonaConnectionRow[]> {
    return this.db.query<PersonaConnectionRow>(
      'SELECT * FROM persona_connections WHERE persona_id = ?',
      [personaId],
    );
  }

  async updateConnections(
    personaId: string,
    connections: Array<{ entityType: string; entityId: string }>,
  ): Promise<PersonaConnectionRow[]> {
    this.db.run('DELETE FROM persona_connections WHERE persona_id = ?', [personaId]);
    for (const conn of connections) {
      this.db.run(
        'INSERT INTO persona_connections (persona_id, entity_type, entity_id) VALUES (?, ?, ?)',
        [personaId, conn.entityType, conn.entityId],
      );
    }
    return this.getConnections(personaId);
  }

  async findForEntity(entityType: string, entityId: string): Promise<PersonaRow[]> {
    return this.db.query<PersonaRow>(
      `SELECT p.* FROM personas p
       JOIN persona_connections pc ON pc.persona_id = p.id
       WHERE pc.entity_type = ? AND pc.entity_id = ?`,
      [entityType, entityId],
    );
  }

  async getDefault(): Promise<PersonaRow | null> {
    return this.db.get<PersonaRow>('SELECT * FROM personas WHERE is_default = 1');
  }
}
