/// <reference types="vitest/globals" />
import type { SecretService } from '../../secret/secret.service';
import type { LocalEmbeddingService } from '../local-embedding.service';
import { z } from 'zod';

const { generateTextMock, streamTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');

  return {
    ...actual,
    generateText: generateTextMock,
    streamText: streamTextMock,
  };
});

import { AiProviderService } from '../ai-provider.service';

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

function makeStream(parts: unknown[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) {
        yield part;
      }
    })(),
  };
}

describe('AiProviderService', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    streamTextMock.mockReset();
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
            reasoningSummary: 'detailed',
            reasoningEffort: 'medium',
          },
        },
      }),
    );
  });

  it('omits providerOptions when generationConfig is empty', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'mistral',
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: 'hello' }],
      generationConfig: {},
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: undefined,
      }),
    );
  });

  it('routes custom google provider options to google with reasoning defaults', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'custom',
      customApiFormat: 'google',
      model: 'gemini-3-flash-preview',
      reverseProxy: 'https://example.com/v1beta',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          google: {
            thinkingConfig: {
              includeThoughts: true,
              thinkingLevel: 'medium',
            },
          },
        },
      }),
    );
  });

  it('routes custom openai provider options to openai with reasoning summary', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'custom',
      customApiFormat: 'openai',
      model: 'gpt-5.2',
      reverseProxy: 'https://example.com/v1',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
            reasoningSummary: 'detailed',
          },
        },
      }),
    );
  });

  it('does not inject openai reasoning defaults for non-reasoning models', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'custom',
      customApiFormat: 'openai',
      model: 'gpt-4.1-mini',
      reverseProxy: 'https://example.com/v1',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: undefined,
      }),
    );
  });

  it('routes custom openai-compatible provider options to custom', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'custom',
      customApiFormat: 'openai-compatible',
      model: 'deepseek-r1',
      reverseProxy: 'https://example.com/v1',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          custom: {
            reasoningEffort: 'medium',
          },
        },
      }),
    );
  });

  it('routes openrouter provider options through the openai key', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'openrouter',
      model: 'openai/gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
            reasoningSummary: 'detailed',
          },
        },
      }),
    );
  });

  it('extracts reasoning from reasoning chunks with delta, textDelta, and text fields', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([
        { type: 'reasoning-delta', delta: 'alpha' },
        { type: 'reasoning-delta', textDelta: 'beta' },
        { type: 'reasoning', textDelta: 'gamma' },
        { type: 'reasoning', text: 'delta' },
        { type: 'text-delta', textDelta: 'final' },
      ]),
    );

    const chunks = [];
    for await (const chunk of service.streamComplete({
      provider: 'openai',
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { reasoning: 'alpha' },
      { reasoning: 'beta' },
      { reasoning: 'gamma' },
      { reasoning: 'delta' },
      { content: 'final' },
    ]);
  });

  it('extracts content from text chunks with text, textDelta, and delta fields', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([
        { type: 'text-delta', text: 'alpha' },
        { type: 'text-delta', textDelta: 'beta' },
        { type: 'text-delta', delta: 'gamma' },
        { type: 'text', text: 'delta' },
      ]),
    );

    const chunks = [];
    for await (const chunk of service.streamComplete({
      provider: 'openai',
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: 'alpha' },
      { content: 'beta' },
      { content: 'gamma' },
      { content: 'delta' },
    ]);
  });

  it('streamComplete throws provider Error chunks', async () => {
    const service = createServiceWithKey('sk-test');
    const providerError = new Error('provider failed');
    streamTextMock.mockReturnValue(makeStream([{ type: 'error', error: providerError }]));

    await expect(
      (async () => {
        for await (const _chunk of service.streamComplete({
          provider: 'openai',
          model: 'gpt-5.2',
          messages: [{ role: 'user', content: 'hello' }],
        })) {
          // no-op
        }
      })(),
    ).rejects.toThrow('provider failed');
  });

  it('streamComplete wraps non-Error provider chunks into Errors', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(makeStream([{ type: 'error', error: { code: 'boom' } }]));

    await expect(
      (async () => {
        for await (const _chunk of service.streamComplete({
          provider: 'openai',
          model: 'gpt-5.2',
          messages: [{ role: 'user', content: 'hello' }],
        })) {
          // no-op
        }
      })(),
    ).rejects.toThrow('{"code":"boom"}');
  });

  it('preserves explicit zero-valued sampling settings', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'openai',
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: 'hello' }],
      topK: 0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
      }),
    );
  });

  it('omits topK for Google native SDK (custom + google format)', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'custom',
      customApiFormat: 'google',
      reverseProxy: 'https://generativelanguage.googleapis.com',
      model: 'gemini-3-flash-preview',
      messages: [{ role: 'user', content: 'hello' }],
      topK: 40,
      topP: 0.9,
    });

    const args = generateTextMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('topK');
    expect(args.topP).toBe(0.9);
  });

  it('omits topK for google provider', async () => {
    const service = createServiceWithKey('sk-test');

    await service.complete({
      provider: 'google',
      model: 'gemini-3-flash-preview',
      messages: [{ role: 'user', content: 'hello' }],
      topK: 40,
    });

    const args = generateTextMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('topK');
  });

  it('streamComplete omits topK from call and providerOptions when generationConfig carries topK', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue({ fullStream: (async function* () {})() });

    const chunks: unknown[] = [];
    for await (const chunk of service.streamComplete({
      provider: 'google',
      model: 'gemini-3-flash-preview',
      messages: [{ role: 'user', content: 'hello' }],
      topK: 40,
      generationConfig: { topK: 99 },
    })) {
      chunks.push(chunk);
    }

    const args = streamTextMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('topK');
    const po = args.providerOptions as { google?: Record<string, unknown> } | undefined;
    expect(po?.google).toBeDefined();
    expect(po?.google).not.toHaveProperty('topK');
  });

  it('extracts think-tag reasoning in structured streams when no native reasoning exists', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([{ type: 'text-delta', textDelta: '<think>fallback</think>{"blocks":[]}' }]),
    );

    const chunks = [];
    for await (const chunk of service.streamStructured(
      {
        provider: 'openai',
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: 'hello' }],
      },
      z.any(),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ reasoning: 'fallback' }, { partial: { blocks: [] } }]);
  });

  it('parses structured streams from text-delta text chunks', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([{ type: 'text-delta', text: '{"blocks":[]}' }]),
    );

    const chunks = [];
    for await (const chunk of service.streamStructured(
      {
        provider: 'openai',
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: 'hello' }],
      },
      z.any(),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ partial: { blocks: [] } }]);
  });

  it('does not duplicate think-tag reasoning when native reasoning chunks are present', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([
        { type: 'reasoning-delta', delta: 'native' },
        { type: 'text-delta', textDelta: '<think>fallback</think>{"blocks":[]}' },
      ]),
    );

    const chunks = [];
    for await (const chunk of service.streamStructured(
      {
        provider: 'openai',
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: 'hello' }],
      },
      z.any(),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ reasoning: 'native' }, { partial: { blocks: [] } }]);
  });

  it('extracts multiple think blocks before parsing structured JSON', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(
      makeStream([
        {
          type: 'text-delta',
          textDelta: '<think>first</think><think>second</think>{"blocks":[]}',
        },
      ]),
    );

    const chunks = [];
    for await (const chunk of service.streamStructured(
      {
        provider: 'openai',
        model: 'gpt-5.2',
        messages: [{ role: 'user', content: 'hello' }],
      },
      z.any(),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { reasoning: 'first' },
      { reasoning: 'second' },
      { partial: { blocks: [] } },
    ]);
  });

  it('streamStructured throws provider Error chunks', async () => {
    const service = createServiceWithKey('sk-test');
    const providerError = new Error('structured provider failed');
    streamTextMock.mockReturnValue(makeStream([{ type: 'error', error: providerError }]));

    await expect(
      (async () => {
        for await (const _chunk of service.streamStructured(
          {
            provider: 'openai',
            model: 'gpt-5.2',
            messages: [{ role: 'user', content: 'hello' }],
          },
          z.any(),
        )) {
          // no-op
        }
      })(),
    ).rejects.toThrow('structured provider failed');
  });

  it('streamStructured wraps non-Error provider chunks into Errors', async () => {
    const service = createServiceWithKey('sk-test');
    streamTextMock.mockReturnValue(makeStream([{ type: 'error', error: { code: 'structured-boom' } }]));

    await expect(
      (async () => {
        for await (const _chunk of service.streamStructured(
          {
            provider: 'openai',
            model: 'gpt-5.2',
            messages: [{ role: 'user', content: 'hello' }],
          },
          z.any(),
        )) {
          // no-op
        }
      })(),
    ).rejects.toThrow('{"code":"structured-boom"}');
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
