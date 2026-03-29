/// <reference types="vitest/globals" />
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  it('returns ok health payload', () => {
    const controller = new HealthController();
    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
