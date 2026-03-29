/// <reference types="vitest/globals" />
import { GroupService } from './group.service';
import { createDrizzleServiceMock } from '@/test/drizzle-mock';

describe('GroupService', () => {
  it('creates a group', async () => {
    const db = createDrizzleServiceMock();
    const service = new GroupService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({ id: 'g1', name: 'Test Group' });

    const result = await service.create({ name: 'Test Group' });

    const [sql] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO groups');
    expect(result.name).toBe('Test Group');
  });

  it('adds a member', async () => {
    const db = createDrizzleServiceMock();
    const service = new GroupService(db);
    db.get.mockReturnValueOnce({ max_order: 1 });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.query.mockReturnValue([{ group_id: 'g1', character_id: 5, sort_order: 2 }]);

    const result = await service.addMember('g1', 5);

    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT OR IGNORE INTO group_members');
    expect(params).toContain('g1');
    expect(params).toContain(5);
    expect(result).toHaveLength(1);
  });

  it('removes a member', async () => {
    const db = createDrizzleServiceMock();
    const service = new GroupService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.query.mockReturnValue([]);

    const result = await service.removeMember('g1', 5);

    const [sql, params] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM group_members');
    expect(params).toEqual(['g1', 5]);
    expect(result).toHaveLength(0);
  });

  it('gets enabled members excluding disabled', async () => {
    const db = createDrizzleServiceMock();
    const service = new GroupService(db);
    db.get.mockResolvedValueOnce({ id: 'g1', disabled_members: '[2]' });
    db.query.mockReturnValue([
      { group_id: 'g1', character_id: 1, sort_order: 0 },
      { group_id: 'g1', character_id: 2, sort_order: 1 },
      { group_id: 'g1', character_id: 3, sort_order: 2 },
    ]);

    const result = await service.getEnabledMembers('g1');

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.character_id)).toEqual([1, 3]);
  });

  it('deletes a group', async () => {
    const db = createDrizzleServiceMock();
    const service = new GroupService(db);
    db.get.mockResolvedValueOnce({ id: 'g1', name: 'Delete Me' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.remove('g1');

    expect(db.run).toHaveBeenCalledWith('DELETE FROM groups WHERE id = ?', ['g1']);
    expect(result?.name).toBe('Delete Me');
  });
});
