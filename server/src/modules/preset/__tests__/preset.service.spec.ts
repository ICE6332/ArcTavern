/// <reference types="vitest/globals" />
import { PresetService } from '../preset.service';
import type { DrizzleService } from '../../../db/drizzle.service';

function toStoreKey(value: unknown): string {
  return String(value);
}

function makeMockDb(): DrizzleService {
  const store = new Map<string, unknown[]>();
  let nextId = 1;

  return {
    query: vi.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM presets WHERE api_type = ?')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.filter((r) => r.api_type === params?.[0]);
      }
      if (sql.includes('FROM presets WHERE name = ? AND api_type = ?')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.filter((r) => r.name === params?.[0] && r.api_type === params?.[1]);
      }
      if (sql.includes('FROM presets WHERE id = ?')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.filter((r) => r.id === params?.[0]);
      }
      if (sql.includes('is_default = 1')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.filter((r) => r.is_default === 1 && r.api_type === params?.[0]);
      }
      return Array.from(store.values()).flat();
    }),

    get: vi.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('WHERE id = ?')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.find((r) => r.id === params?.[0]) ?? null;
      }
      if (sql.includes('WHERE name = ? AND api_type = ?')) {
        const all = Array.from(store.values()).flat() as Array<Record<string, unknown>>;
        return all.find((r) => r.name === params?.[0] && r.api_type === params?.[1]) ?? null;
      }
      return null;
    }),

    run: vi.fn((sql: string, params?: unknown[]) => {
      if (sql.startsWith('INSERT')) {
        const id = nextId++;
        const row: Record<string, unknown> = {
          id,
          name: params?.[0],
          api_type: params?.[1],
          data: params?.[2],
          is_default: params?.[3] ?? 0,
          source_hash: params?.[4] ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const key = `${id}`;
        store.set(key, [row]);
        return { changes: 1, lastId: id };
      }
      if (sql.startsWith('DELETE')) {
        const id = params?.[params.length - 1];
        store.delete(toStoreKey(id));
        return { changes: 1, lastId: 0 };
      }
      if (sql.startsWith('UPDATE')) {
        // Find and update
        const id = params?.[params.length - 1];
        const existing = store.get(toStoreKey(id));
        if (existing && existing[0]) {
          const row = existing[0] as Record<string, unknown>;
          if (sql.includes('data = ?')) {
            row.data = params?.[0];
          }
          if (sql.includes('source_hash = ?')) {
            row.source_hash = params?.[1];
          }
        }
        return { changes: 1, lastId: 0 };
      }
      return { changes: 0, lastId: 0 };
    }),
  } as unknown as DrizzleService;
}

describe('PresetService', () => {
  it('creates a preset and retrieves it', () => {
    const db = makeMockDb();
    const service = new PresetService(db);

    const result = service.create({
      name: 'Test',
      apiType: 'openai',
      data: '{"temperature":0.7}',
    });

    expect(result).toBeTruthy();
    expect(result.name).toBe('Test');
  });

  it('rejects deletion of default presets', () => {
    const db = makeMockDb();
    const service = new PresetService(db);

    // Insert a default preset
    (db.run as ReturnType<typeof vi.fn>).mockImplementationOnce((_sql: string) => {
      const id = 1;
      return { changes: 1, lastId: id };
    });
    (db.get as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      id: 1,
      name: 'Default',
      api_type: 'openai',
      data: '{}',
      is_default: 1,
      source_hash: 'abc',
      created_at: '',
      updated_at: '',
    }));

    expect(() => service.remove(1)).toThrow('Cannot delete default preset');
  });

  it('importPreset stores full JSON data', () => {
    const db = makeMockDb();
    const service = new PresetService(db);

    const result = service.importPreset('Imported', 'openai', {
      temperature: 0.5,
      prompts: [],
    });

    expect(result).toBeTruthy();
    expect(result.name).toBe('Imported');
  });

  it('exportPreset returns parsed JSON', () => {
    const db = makeMockDb();
    const service = new PresetService(db);

    const created = service.create({
      name: 'Export Test',
      apiType: 'openai',
      data: JSON.stringify({ temperature: 0.9 }),
    });

    const exported = service.exportPreset(created.id);
    expect(exported).toBeTruthy();
    expect(exported!.data.temperature).toBe(0.9);
  });

  it('exportPreset returns null for missing preset', () => {
    const db = makeMockDb();
    const service = new PresetService(db);

    const exported = service.exportPreset(99999);
    expect(exported).toBeNull();
  });
});
