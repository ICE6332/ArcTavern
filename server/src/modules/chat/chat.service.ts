import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';

export interface ChatRow {
  id: number;
  character_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  chat_id: number;
  role: string;
  name: string;
  content: string;
  is_hidden: number;
  swipe_id: number;
  swipes: string;
  gen_started: string | null;
  gen_finished: string | null;
  extra: string;
  created_at: string;
}

@Injectable()
export class ChatService {
  constructor(private readonly db: DrizzleService) {}

  async findAllByCharacter(characterId: number): Promise<ChatRow[]> {
    return this.db.query<ChatRow>(
      'SELECT * FROM chats WHERE character_id = ? ORDER BY updated_at DESC',
      [characterId],
    );
  }

  async findOne(id: number): Promise<ChatRow | null> {
    return this.db.get<ChatRow>('SELECT * FROM chats WHERE id = ?', [id]);
  }

  async create(characterId: number, name?: string): Promise<ChatRow> {
    const { lastId } = this.db.run(
      'INSERT INTO chats (character_id, name) VALUES (?, ?)',
      [characterId, name ?? ''],
    );
    return (await this.findOne(lastId))!;
  }

  async updateName(id: number, name: string): Promise<ChatRow | null> {
    const chat = await this.findOne(id);
    if (!chat) return null;
    this.db.run(
      "UPDATE chats SET name = ?, updated_at = datetime('now') WHERE id = ?",
      [name, id],
    );
    return this.findOne(id);
  }

  async remove(id: number): Promise<ChatRow | null> {
    const chat = await this.findOne(id);
    if (chat) this.db.run('DELETE FROM chats WHERE id = ?', [id]);
    return chat;
  }

  async getMessages(chatId: number): Promise<MessageRow[]> {
    return this.db.query<MessageRow>(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC',
      [chatId],
    );
  }

  async findMessageById(id: number): Promise<MessageRow | null> {
    return this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
  }

  async addMessage(data: {
    chatId: number;
    role: string;
    name?: string;
    content: string;
    swipeId?: number;
    swipes?: string;
    genStarted?: string | null;
    genFinished?: string | null;
    extra?: string;
  }): Promise<MessageRow> {
    const { lastId } = this.db.run(
      'INSERT INTO messages (chat_id, role, name, content, swipe_id, swipes, gen_started, gen_finished, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.chatId,
        data.role,
        data.name ?? '',
        data.content,
        data.swipeId ?? 0,
        data.swipes ?? '[]',
        data.genStarted ?? null,
        data.genFinished ?? null,
        data.extra ?? '{}',
      ],
    );
    this.db.run("UPDATE chats SET updated_at = datetime('now') WHERE id = ?", [data.chatId]);
    return this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [lastId])!;
  }

  async updateMessage(id: number, data: Record<string, unknown>): Promise<MessageRow | null> {
    const fieldMap: Record<string, string> = {
      content: 'content', name: 'name', isHidden: 'is_hidden',
      swipeId: 'swipe_id', swipes: 'swipes', genStarted: 'gen_started',
      genFinished: 'gen_finished', extra: 'extra',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(data)) {
      const col = fieldMap[key];
      if (col) { sets.push(`${col} = ?`); values.push(val); }
    }
    if (sets.length === 0) return this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
    values.push(id);
    this.db.run(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, values);
    return this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
  }

  async deleteMessage(id: number): Promise<MessageRow | null> {
    const msg = this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [id]);
    if (msg) this.db.run('DELETE FROM messages WHERE id = ?', [id]);
    return msg;
  }
}
