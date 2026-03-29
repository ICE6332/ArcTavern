/// <reference types="vitest/globals" />
import { WorldInfoService } from '../world-info.service';
import { createDrizzleServiceMock } from '@/test/drizzle-mock';

describe('WorldInfoService', () => {
  it('creates a book', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 5 });
    db.get.mockResolvedValueOnce({ id: 5, name: 'Test Book', description: '' });

    const result = await service.createBook({ name: 'Test Book' });

    const [sql] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO world_info_books');
    expect(result.name).toBe('Test Book');
  });

  it('creates an entry with auto-uid', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.get.mockReturnValueOnce({ max_uid: 3 }); // max uid query
    db.run.mockReturnValue({ changes: 1, lastId: 10 });
    db.get.mockResolvedValueOnce({
      id: 10,
      book_id: 1,
      uid: 4,
      keys: '["test"]',
      content: 'hello',
    });

    const result = await service.createEntry(1, { keys: '["test"]', content: 'hello' });

    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO world_info_entries');
    expect(params[1]).toBe(4); // uid = max + 1
    expect(result.id).toBe(10);
  });

  it('updates an entry with mapped fields', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({ id: 1, content: 'updated' });

    await service.updateEntry(1, { content: 'updated', priority: 20 });

    const [sql, values] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('content = ?');
    expect(sql).toContain('priority = ?');
    expect(values).toContain('updated');
    expect(values).toContain(20);
  });

  it('exports a book with entries', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.get.mockResolvedValueOnce({ id: 1, name: 'Export Book' });
    db.query.mockReturnValue([{ id: 1, book_id: 1, content: 'entry1' }]);

    const result = await service.exportBook(1);

    expect(result).not.toBeNull();
    expect(result!.book.name).toBe('Export Book');
    expect(result!.entries).toHaveLength(1);
  });

  it('returns null when exporting non-existent book', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.get.mockResolvedValueOnce(null);

    const result = await service.exportBook(999);

    expect(result).toBeNull();
  });

  it('deletes a book', async () => {
    const db = createDrizzleServiceMock();
    const service = new WorldInfoService(db);
    db.get.mockResolvedValueOnce({ id: 1, name: 'Delete Me' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.deleteBook(1);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM world_info_books WHERE id = ?', [1]);
    expect(result?.name).toBe('Delete Me');
  });
});
