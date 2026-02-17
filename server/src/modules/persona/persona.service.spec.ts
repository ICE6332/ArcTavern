/// <reference types="vitest/globals" />
import { PersonaService } from './persona.service';
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

describe('PersonaService', () => {
  it('creates a persona', async () => {
    const db = makeDbMock();
    const service = new PersonaService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.get.mockResolvedValueOnce({ id: 'p1', name: 'Test Persona', description: 'desc' });

    const result = await service.create({ name: 'Test Persona', description: 'desc' });

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql] = db.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO personas');
    expect(result.name).toBe('Test Persona');
  });

  it('updates connections', async () => {
    const db = makeDbMock();
    const service = new PersonaService(db);
    db.run.mockReturnValue({ changes: 1, lastId: 0 });
    db.query.mockReturnValue([{ persona_id: 'p1', entity_type: 'character', entity_id: '1' }]);

    const result = await service.updateConnections('p1', [
      { entityType: 'character', entityId: '1' },
    ]);

    // First call deletes existing, second inserts new
    expect(db.run).toHaveBeenCalledTimes(2);
    const [deleteSql] = db.run.mock.calls[0] as [string, unknown[]];
    expect(deleteSql).toContain('DELETE FROM persona_connections');
    const [insertSql] = db.run.mock.calls[1] as [string, unknown[]];
    expect(insertSql).toContain('INSERT INTO persona_connections');
    expect(result).toHaveLength(1);
  });

  it('finds personas for entity', async () => {
    const db = makeDbMock();
    const service = new PersonaService(db);
    db.query.mockReturnValue([{ id: 'p1', name: 'Persona 1' }]);

    const result = await service.findForEntity('character', '1');

    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('JOIN persona_connections');
    expect(params).toEqual(['character', '1']);
    expect(result).toHaveLength(1);
  });

  it('gets default persona', async () => {
    const db = makeDbMock();
    const service = new PersonaService(db);
    db.get.mockResolvedValueOnce({ id: 'p1', name: 'Default', is_default: 1 });

    const result = await service.getDefault();

    const [sql] = db.get.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('is_default = 1');
    expect(result?.name).toBe('Default');
  });

  it('deletes a persona', async () => {
    const db = makeDbMock();
    const service = new PersonaService(db);
    db.get.mockResolvedValueOnce({ id: 'p1', name: 'Delete Me' });
    db.run.mockReturnValue({ changes: 1, lastId: 0 });

    const result = await service.remove('p1');

    expect(db.run).toHaveBeenCalledWith('DELETE FROM personas WHERE id = ?', ['p1']);
    expect(result?.name).toBe('Delete Me');
  });
});
