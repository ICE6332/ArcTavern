import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface GroupRow {
  id: string;
  name: string;
  avatar_url: string | null;
  allow_self_responses: number;
  activation_strategy: number;
  generation_mode: number;
  disabled_members: string;
  fav: number;
  current_chat_id: number | null;
  auto_mode_delay: number;
  join_prefix: string;
  join_suffix: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRow {
  group_id: string;
  character_id: number;
  sort_order: number;
}

@Injectable()
export class GroupService {
  constructor(private readonly db: DrizzleService) {}

  async findAll(): Promise<GroupRow[]> {
    return this.db.query<GroupRow>('SELECT * FROM groups ORDER BY updated_at DESC');
  }

  async findOne(id: string): Promise<GroupRow | null> {
    return this.db.get<GroupRow>('SELECT * FROM groups WHERE id = ?', [id]);
  }

  async create(data: {
    name: string;
    avatarUrl?: string;
    allowSelfResponses?: boolean;
    activationStrategy?: number;
    generationMode?: number;
    autoModeDelay?: number;
    joinPrefix?: string;
    joinSuffix?: string;
  }): Promise<GroupRow> {
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO groups (id, name, avatar_url, allow_self_responses, activation_strategy,
       generation_mode, auto_mode_delay, join_prefix, join_suffix)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.avatarUrl ?? null,
        data.allowSelfResponses ? 1 : 0,
        data.activationStrategy ?? 0,
        data.generationMode ?? 0,
        data.autoModeDelay ?? 5,
        data.joinPrefix ?? '',
        data.joinSuffix ?? '',
      ],
    );
    return (await this.findOne(id))!;
  }

  async update(id: string, data: Record<string, unknown>): Promise<GroupRow | null> {
    const fieldMap: Record<string, string> = {
      name: 'name',
      avatarUrl: 'avatar_url',
      allowSelfResponses: 'allow_self_responses',
      activationStrategy: 'activation_strategy',
      generationMode: 'generation_mode',
      disabledMembers: 'disabled_members',
      fav: 'fav',
      currentChatId: 'current_chat_id',
      autoModeDelay: 'auto_mode_delay',
      joinPrefix: 'join_prefix',
      joinSuffix: 'join_suffix',
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
    this.db.run(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.findOne(id);
  }

  async remove(id: string): Promise<GroupRow | null> {
    const group = await this.findOne(id);
    if (group) this.db.run('DELETE FROM groups WHERE id = ?', [id]);
    return group;
  }

  async getMembers(groupId: string): Promise<GroupMemberRow[]> {
    return this.db.query<GroupMemberRow>(
      'SELECT * FROM group_members WHERE group_id = ? ORDER BY sort_order ASC',
      [groupId],
    );
  }

  async addMember(
    groupId: string,
    characterId: number,
    sortOrder?: number,
  ): Promise<GroupMemberRow[]> {
    const maxOrder = this.db.get<{ max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM group_members WHERE group_id = ?',
      [groupId],
    );
    this.db.run(
      'INSERT OR IGNORE INTO group_members (group_id, character_id, sort_order) VALUES (?, ?, ?)',
      [groupId, characterId, sortOrder ?? (maxOrder?.max_order ?? -1) + 1],
    );
    return this.getMembers(groupId);
  }

  async removeMember(groupId: string, characterId: number): Promise<GroupMemberRow[]> {
    this.db.run('DELETE FROM group_members WHERE group_id = ? AND character_id = ?', [
      groupId,
      characterId,
    ]);
    return this.getMembers(groupId);
  }

  async updateMemberOrder(
    groupId: string,
    memberOrder: Array<{ characterId: number; sortOrder: number }>,
  ): Promise<GroupMemberRow[]> {
    for (const item of memberOrder) {
      this.db.run(
        'UPDATE group_members SET sort_order = ? WHERE group_id = ? AND character_id = ?',
        [item.sortOrder, groupId, item.characterId],
      );
    }
    return this.getMembers(groupId);
  }

  async getEnabledMembers(groupId: string): Promise<GroupMemberRow[]> {
    const group = await this.findOne(groupId);
    if (!group) return [];
    let disabled: number[] = [];
    try {
      disabled = JSON.parse(group.disabled_members);
    } catch {}
    const members = await this.getMembers(groupId);
    return members.filter((m) => !disabled.includes(m.character_id));
  }
}
