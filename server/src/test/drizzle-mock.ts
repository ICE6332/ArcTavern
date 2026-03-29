import { vi, type Mock } from 'vitest';
import type { DrizzleService } from '@/db/drizzle.service';

/** 各 Service 单测共用的 DrizzleService mock（query / get / run）。 */
export type DrizzleServiceMock = DrizzleService & {
  query: Mock;
  get: Mock;
  run: Mock;
};

export function createDrizzleServiceMock(): DrizzleServiceMock {
  return {
    query: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  } as unknown as DrizzleServiceMock;
}
