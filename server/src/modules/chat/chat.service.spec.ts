/// <reference types="vitest/globals" />
import { ChatService } from './chat.service';
import { createDrizzleServiceMock } from '@/test/drizzle-mock';

describe('ChatService', () => {
  it('creates chat and returns inserted row', async () => {
    const db = createDrizzleServiceMock();
    const service = new ChatService(db);

    db.run.mockReturnValue({ changes: 1, lastId: 9 });
    db.get.mockReturnValue({ id: 9, character_id: 1, name: 'New Chat' });

    const result = await service.create(1, 'New Chat');

    expect(db.run).toHaveBeenCalledWith('INSERT INTO chats (character_id, name) VALUES (?, ?)', [
      1,
      'New Chat',
    ]);
    expect(result).toEqual({ id: 9, character_id: 1, name: 'New Chat' });
  });

  it('adds message and updates chat timestamp', async () => {
    const db = createDrizzleServiceMock();
    const service = new ChatService(db);

    db.run.mockReturnValueOnce({ changes: 1, lastId: 15 }).mockReturnValueOnce({
      changes: 1,
      lastId: 0,
    });
    db.get.mockReturnValue({ id: 15, chat_id: 3, role: 'user', content: 'hello' });

    const result = await service.addMessage({
      chatId: 3,
      role: 'user',
      content: 'hello',
    });

    expect(db.run).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO messages (chat_id, role, name, content, swipe_id, swipes, gen_started, gen_finished, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [3, 'user', '', 'hello', 0, '[]', null, null, '{}'],
    );
    expect(db.run).toHaveBeenNthCalledWith(
      2,
      "UPDATE chats SET updated_at = datetime('now') WHERE id = ?",
      [3],
    );
    expect(result).toEqual({ id: 15, chat_id: 3, role: 'user', content: 'hello' });
  });

  it('updates message with mapped fields', async () => {
    const db = createDrizzleServiceMock();
    const service = new ChatService(db);

    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockReturnValue({ id: 5, content: 'edited' });

    const result = await service.updateMessage(5, {
      content: 'edited',
      swipeId: 2,
      isHidden: true,
      unknown: 'ignored',
    });

    const [sql, values] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('content = ?');
    expect(sql).toContain('swipe_id = ?');
    expect(sql).toContain('is_hidden = ?');
    expect(values).toEqual(['edited', 2, true, 5]);
    expect(result).toEqual({ id: 5, content: 'edited' });
  });

  it('deletes message and returns deleted row', async () => {
    const db = createDrizzleServiceMock();
    const service = new ChatService(db);

    db.get.mockReturnValue({ id: 11, content: 'bye' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.deleteMessage(11);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM messages WHERE id = ?', [11]);
    expect(result).toEqual({ id: 11, content: 'bye' });
  });
});
