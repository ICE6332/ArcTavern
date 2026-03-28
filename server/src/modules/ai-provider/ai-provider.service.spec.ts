/// <reference types="vitest/globals" />
import type { SecretService } from '../secret/secret.service';
import type { LocalEmbeddingService } from './local-embedding.service';

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');

  return {
    ...actual,
    generateText: generateTextMock,
  };
});

import { AiProviderService } from './ai-provider.service';

function createService() {
  const secretService = {
    get: async () => null,
    set: async () => undefined,
    remove: async () => undefined,
    listKeys: async () => [],
  } as unknown as SecretService;
  const localEmbedding = {
    embed: async () => ({ embeddings: [], dimensions: 0 }),
  } as unknown as LocalEmbeddingService;

  return new AiProviderService(secretService, localEmbedding);
}

function createServiceWithKey(key: string) {
  const secretService = {
    get: async () => key,
    set: async () => undefined,
    remove: async () => undefined,
    listKeys: async () => [],
  } as unknown as SecretService;
  const localEmbedding = {
    embed: async () => ({ embeddings: [], dimensions: 0 }),
  } as unknown as LocalEmbeddingService;

  return new AiProviderService(secretService, localEmbedding);
}

describe('AiProviderService', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue({
      text: 'ok',
      response: { modelId: 'gpt-5.2' },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
  });

  it('returns model catalog grouped by provider', () => {
    const service = createService();
    const models = service.getModels();

    expect(Array.isArray(models)).toBe(true);
    expect(models.some((entry) => 'provider' in entry && entry.provider === 'openai')).toBe(true);
  });

  it('returns provider-scoped models', () => {
    const service = createService();
    const openaiModels = service.getModels('openai');

    expect(Array.isArray(openaiModels)).toBe(true);
    expect(openaiModels.length).toBeGreaterThan(0);
  });

  it('provides approximate token counting', async () => {
    const service = createService();
    const result = await service.tokenize({ text: 'hello world' });

    expect(result.method).toBe('approximate');
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('passes providerOptions when generationConfig is present', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'openai',
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
      generationConfig: {
        reasoningEffort: 'medium',
      },
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
          },
        },
      }),
    );
  });

  it('omits providerOptions when generationConfig is empty', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'openai',
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
      generationConfig: {},
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: undefined,
      }),
    );
  });

  it('does not duplicate /v1 for health-check models endpoint', async () => {
    const service = createService();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.healthCheck({
      provider: 'custom',
      apiKey: 'sk-test',
      baseUrl: 'https://example.com/v1',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/v1/models', expect.any(Object));
    expect(result.status).toBe('ok');
    fetchMock.mockRestore();
  });

  it('uses saved key for health-check when apiKey is omitted', async () => {
    const service = createServiceWithKey('sk-saved');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.healthCheck({
      provider: 'custom',
      baseUrl: 'https://example.com/v1',
    });

    expect(result.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-saved',
        }),
      }),
    );
    fetchMock.mockRestore();
  });

  it('does not duplicate /v1 for test-request chat endpoint', async () => {
    const service = createService();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'chatcmpl-test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await service.testRequest({
      provider: 'custom',
      apiKey: 'sk-test',
      baseUrl: 'https://example.com/v1',
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/chat/completions',
      expect.any(Object),
    );
    fetchMock.mockRestore();
  });
});
