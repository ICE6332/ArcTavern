import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface CharacterRow {
  id: number;
  name: string;
  avatar: string | null;
  description: string;
  personality: string;
  first_mes: string;
  mes_example: string;
  scenario: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string;
  creator: string;
  creator_notes: string;
  character_version: string;
  tags: string;
  spec: string;
  spec_version: string;
  extensions: string;
  character_book: string | null;
  world_info_book_id: number | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CharacterService {
  constructor(private readonly db: DrizzleService) {}

  async findAll(): Promise<CharacterRow[]> {
    return this.db.query<CharacterRow>('SELECT * FROM characters ORDER BY updated_at DESC');
  }

  async findOne(id: number): Promise<CharacterRow | null> {
    return this.db.get<CharacterRow>('SELECT * FROM characters WHERE id = ?', [id]);
  }

  async create(data: {
    name: string;
    avatar?: string;
    description?: string;
    personality?: string;
    firstMes?: string;
    mesExample?: string;
    scenario?: string;
    systemPrompt?: string;
    postHistoryInstructions?: string;
    alternateGreetings?: string;
    creator?: string;
    creatorNotes?: string;
    characterVersion?: string;
    tags?: string;
    extensions?: string;
    characterBook?: string | null;
  }): Promise<CharacterRow> {
    const { lastId } = this.db.run(
      `INSERT INTO characters (
        name, avatar, description, personality, first_mes, mes_example, scenario,
        system_prompt, post_history_instructions, alternate_greetings, creator,
        creator_notes, character_version, tags, extensions, character_book
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.avatar ?? null,
        data.description ?? '',
        data.personality ?? '',
        data.firstMes ?? '',
        data.mesExample ?? '',
        data.scenario ?? '',
        data.systemPrompt ?? '',
        data.postHistoryInstructions ?? '',
        data.alternateGreetings ?? '[]',
        data.creator ?? '',
        data.creatorNotes ?? '',
        data.characterVersion ?? '',
        data.tags ?? '[]',
        data.extensions ?? '{}',
        data.characterBook ?? null,
      ],
    );
    return (await this.findOne(lastId))!;
  }

  async update(id: number, data: Record<string, unknown>): Promise<CharacterRow | null> {
    const fieldMap: Record<string, string> = {
      name: 'name', avatar: 'avatar', description: 'description',
      personality: 'personality', firstMes: 'first_mes', mesExample: 'mes_example',
      scenario: 'scenario', systemPrompt: 'system_prompt',
      postHistoryInstructions: 'post_history_instructions',
      alternateGreetings: 'alternate_greetings',
      creator: 'creator', creatorNotes: 'creator_notes',
      characterVersion: 'character_version',
      tags: 'tags', extensions: 'extensions', characterBook: 'character_book',
      worldInfoBookId: 'world_info_book_id',
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
    this.db.run(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  async remove(id: number): Promise<CharacterRow | null> {
    const char = await this.findOne(id);
    if (char) this.db.run('DELETE FROM characters WHERE id = ?', [id]);
    return char;
  }
}
