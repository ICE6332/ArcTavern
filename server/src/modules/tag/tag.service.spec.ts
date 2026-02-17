/// <reference types="vitest/globals" />
import { TagService } from './tag.service';
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

describe('TagService', () => {
  it('creates a tag with defaults', async () => {
    const db = makeDbMock();
    const service = new TagService(db);

    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({ id: 'abc', name: 'Test Tag', folder_type: 'NONE', sort_order: 0, color: null, color2: null, is_hidden: 0, created_at: '' });

    const result = await service.create({ name: 'Test Tag' });

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO tags');
    expect(result.name).toBe('Test Tag');
  });

  it('assigns a tag to an entity', async () => {
    const db = makeDbMock();
    const service = new TagService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    await service.assignTag('character', '1', 'tag-1');

    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT OR IGNORE INTO entity_tags');
    expect(params).toEqual(['character', '1', 'tag-1']);
  });

  it('unassigns a tag from an entity', async () => {
    const db = makeDbMock();
    const service = new TagService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    await service.unassignTag('character', '1', 'tag-1');

    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM entity_tags');
    expect(params).toEqual(['character', '1', 'tag-1']);
  });

  it('gets entity tags via join', async () => {
    const db = makeDbMock();
    const service = new TagService(db);
    db.query.mockReturnValue([{ id: 'tag-1', name: 'Tag 1' }]);

    const result = await service.getEntityTags('character', '1');

    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('JOIN entity_tags');
    expect(params).toEqual(['character', '1']);
    expect(result).toHaveLength(1);
  });

  it('updates mapped fields', async () => {
    const db = makeDbMock();
    const service = new TagService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({ id: 'abc', name: 'Updated' });

    await service.update('abc', { name: 'Updated', color: '#ff0000' });

    const [sql, values] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('name = ?');
    expect(sql).toContain('color = ?');
    expect(values).toEqual(['Updated', '#ff0000', 'abc']);
  });

  it('deletes a tag', async () => {
    const db = makeDbMock();
    const service = new TagService(db);
    db.get.mockResolvedValueOnce({ id: 'abc', name: 'Delete Me' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.remove('abc');

    expect(db.run).toHaveBeenCalledWith('DELETE FROM tags WHERE id = ?', ['abc']);
    expect(result?.name).toBe('Delete Me');
  });
});
