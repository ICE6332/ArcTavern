/// <reference types="vitest/globals" />
import { CharacterService } from './character.service';
import type { DrizzleService } from '../../db/drizzle.service';

function makeDbMock() {
  return {
    query: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  } as unknown as DrizzleService & {
    query: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };
}

describe('CharacterService', () => {
  it('creates a character with mapped defaults', async () => {
    const db = makeDbMock();
    const service = new CharacterService(db);

    db.run.mockReturnValue({ changes: 1, lastId: 7 });
    db.get.mockResolvedValueOnce({
      id: 7,
      name: 'Alice',
    });

    const result = await service.create({
      name: 'Alice',
      firstMes: 'hello',
      systemPrompt: 'be concise',
    });

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO characters');
    expect(params[0]).toBe('Alice');
    expect(params[4]).toBe('hello');
    expect(params[8]).toBe('');
    expect(params[14]).toBe('{}');
    expect(params[15]).toBeNull();
    expect(result).toEqual({ id: 7, name: 'Alice' });
  });

  it('updates mapped fields and updated_at', async () => {
    const db = makeDbMock();
    const service = new CharacterService(db);

    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({
      id: 3,
      name: 'Bob',
    });

    await service.update(3, {
      name: 'Bob',
      firstMes: 'new first',
      creatorNotes: 'note',
      unknown: 'skip',
    });

    const [sql, values] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('name = ?');
    expect(sql).toContain('first_mes = ?');
    expect(sql).toContain('creator_notes = ?');
    expect(sql).toContain("updated_at = datetime('now')");
    expect(values).toEqual(['Bob', 'new first', 'note', 3]);
  });

  it('returns current row when no update fields are provided', async () => {
    const db = makeDbMock();
    const service = new CharacterService(db);

    db.get.mockResolvedValueOnce({ id: 1, name: 'Noop' });

    const result = await service.update(1, { invalidOnly: true });

    expect(db.run).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 1, name: 'Noop' });
  });

  it('deletes existing character', async () => {
    const db = makeDbMock();
    const service = new CharacterService(db);

    db.get
      .mockResolvedValueOnce({ id: 2, name: 'Delete Me' })
      .mockResolvedValueOnce({ id: 2, name: 'Delete Me' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.remove(2);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM characters WHERE id = ?', [2]);
    expect(result).toEqual({ id: 2, name: 'Delete Me' });
  });
});
