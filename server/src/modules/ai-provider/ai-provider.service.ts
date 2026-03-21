import { Injectable, BadRequestException } from '@nestjs/common';
import { SecretService } from '../secret/secret.service';
import {
  CompletionRequest,
  CompletionResponse,
  CompletionStreamChunk,
  HealthCheckRequest,
  HealthCheckResponse,
  TestRequestPayload,
  ModelInfo,
  ModelsApiResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ChatMessage,
} from './types';
import { generateText, streamText, embedMany, Output, type ModelMessage } from 'ai';
import type { ZodType } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const SECRET_KEY_MAP: Record<string, string> = {
  openai: 'api_key_openai',
  anthropic: 'api_key_anthropic',
  google: 'api_key_google',
  openrouter: 'api_key_openrouter',
  mistral: 'api_key_mistral',
  custom: 'api_key_custom',
};

const MODEL_CATALOG: Record<string, Array<{ id: string; contextWindow: number }>> = {
  openai: [
    { id: 'gpt-4o', contextWindow: 128_000 },
    { id: 'gpt-4o-mini', contextWindow: 128_000 },
    { id: 'o1', contextWindow: 200_000 },
    { id: 'o3-mini', contextWindow: 200_000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', contextWindow: 200_000 },
    { id: 'claude-opus-4-20250514', contextWindow: 200_000 },
  ],
  google: [
    { id: 'gemini-2.0-flash', contextWindow: 1_000_000 },
    { id: 'gemini-2.0-pro', contextWindow: 1_000_000 },
  ],
  openrouter: [{ id: 'openrouter/auto', contextWindow: 128_000 }],
  mistral: [{ id: 'mistral-large-latest', contextWindow: 128_000 }],
  custom: [],
};

@Injectable()
export class AiProviderService {
  private modelCache = new Map<string, { models: ModelInfo[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly secretService: SecretService) {}

  async getApiKey(provider: string): Promise<string> {
    const secretKey = SECRET_KEY_MAP[provider];
    if (!secretKey) {
      throw new BadRequestException(`No secret key mapping for provider: ${provider}`);
    }
    const key = await this.secretService.get(secretKey);
    if (!key) {
      throw new BadRequestException(`API key not configured for provider: ${provider}`);
    }
    return key;
  }

  private createLanguageModel(
    provider: string,
    model: string,
    apiKey: string,
    reverseProxy?: string,
  ) {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL: reverseProxy })(model);
      case 'anthropic':
        return createAnthropic({ apiKey, baseURL: reverseProxy })(model);
      case 'google':
        return createGoogleGenerativeAI({ apiKey, baseURL: reverseProxy })(model);
      case 'openrouter':
        return createOpenAI({
          apiKey,
          baseURL: reverseProxy || 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'Arctravern',
          },
        })(model);
      case 'mistral':
        return createMistral({ apiKey, baseURL: reverseProxy })(model);
      case 'custom':
        return createOpenAICompatible({
          name: 'custom',
          apiKey,
          baseURL: this.normalizeBaseUrl(reverseProxy!),
        })(model);
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  private createEmbeddingModel(
    provider: string,
    model: string,
    apiKey: string,
    reverseProxy?: string,
  ) {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL: reverseProxy }).embedding(
          model || 'text-embedding-3-small',
        );
      case 'google':
        return createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(
          model || 'text-embedding-004',
        );
      case 'mistral':
        return createMistral({ apiKey }).textEmbeddingModel(
          model || 'mistral-embed',
        );
      case 'openrouter':
        return createOpenAI({
          apiKey,
          baseURL: reverseProxy || 'https://openrouter.ai/api/v1',
        }).embedding(model || 'text-embedding-3-small');
      default:
        throw new BadRequestException(`No embedding support for provider: ${provider}`);
    }
  }

  private convertMessages(messages: ChatMessage[], assistantPrefill?: string): ModelMessage[] {
    const converted: ModelMessage[] = messages.map((msg) => {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((part) => part.text ?? '').join('');

      return { role: msg.role as 'system' | 'user' | 'assistant', content };
    });

    if (assistantPrefill) {
      converted.push({ role: 'assistant', content: assistantPrefill });
    }

    return converted;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createLanguageModel(req.provider, req.model, apiKey, req.reverseProxy);

    const result = await generateText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      topP: req.topP,
      topK: req.topK,
      frequencyPenalty: req.frequencyPenalty,
      presencePenalty: req.presencePenalty,
      stopSequences: req.stop,
    });

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;

    return {
      content: result.text,
      model: result.response?.modelId ?? req.model,
      finishReason: result.finishReason ?? 'stop',
      usage: result.usage
        ? {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
          }
        : undefined,
    };
  }

  async *streamComplete(
    req: CompletionRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<CompletionStreamChunk, void, unknown> {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createLanguageModel(req.provider, req.model, apiKey, req.reverseProxy);

    const result = streamText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      topP: req.topP,
      topK: req.topK,
      frequencyPenalty: req.frequencyPenalty,
      presencePenalty: req.presencePenalty,
      stopSequences: req.stop,
      abortSignal: signal,
    });

    for await (const part of result.fullStream) {
      const chunk = part as { type?: string; textDelta?: string; text?: string };
      const deltaText = chunk.textDelta ?? chunk.text;

      if (chunk.type === 'text-delta' && deltaText) {
        yield { content: deltaText };
        continue;
      }
      if (chunk.type === 'reasoning-delta' && deltaText) {
        yield { reasoning: deltaText };
        continue;
      }
      if (chunk.type === 'text' && chunk.text) {
        yield { content: chunk.text };
        continue;
      }
      if (chunk.type === 'reasoning' && chunk.text) {
        yield { reasoning: chunk.text };
      }
    }
  }

  async *streamStructured<T>(
    req: CompletionRequest,
    schema: ZodType<T>,
    signal?: AbortSignal,
  ): AsyncGenerator<{ partial: unknown }, void, unknown> {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createLanguageModel(req.provider, req.model, apiKey, req.reverseProxy);

    const result = streamText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      output: Output.object({ schema }),
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      topP: req.topP,
      topK: req.topK,
      frequencyPenalty: req.frequencyPenalty,
      presencePenalty: req.presencePenalty,
      stopSequences: req.stop,
      abortSignal: signal,
    });

    for await (const partial of result.partialOutputStream) {
      yield { partial };
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createEmbeddingModel(req.provider, req.model, apiKey, req.reverseProxy);

    const { embeddings, usage } = await embedMany({
      model,
      values: req.input,
    });

    return {
      embeddings,
      model: req.model,
      dimensions: embeddings[0]?.length ?? 0,
      usage: usage ? { promptTokens: usage.tokens, totalTokens: usage.tokens } : undefined,
    };
  }

  async tokenize(input: { text?: string; messages?: CompletionRequest['messages'] }) {
    const text = input.text ?? input.messages?.map((msg) => this.messageToText(msg)).join('\n') ?? '';
    const tokens = Math.max(1, Math.ceil(text.length / 4));
    return {
      tokens,
      method: 'approximate',
    };
  }

  getModels(provider?: string) {
    if (provider) {
      return MODEL_CATALOG[provider] ?? [];
    }

    return Object.entries(MODEL_CATALOG).map(([key, models]) => ({
      provider: key,
      models,
    }));
  }

  private messageToText(message: CompletionRequest['messages'][number]): string {
    const content = message.content;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : (part.text ?? JSON.stringify(part)).toString(),
      )
      .join('');
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '');
  }

  private toModelsUrl(baseUrl: string): string {
    const normalized = this.normalizeBaseUrl(baseUrl);
    const lower = normalized.toLowerCase();
    if (lower.endsWith('/models')) return normalized;
    if (lower.endsWith('/v1')) return `${normalized}/models`;
    return `${normalized}/v1/models`;
  }

  private toChatCompletionsUrl(baseUrl: string): string {
    const normalized = this.normalizeBaseUrl(baseUrl);
    const lower = normalized.toLowerCase();
    if (lower.endsWith('/chat/completions')) return normalized;
    if (lower.endsWith('/v1')) return `${normalized}/chat/completions`;
    return `${normalized}/v1/chat/completions`;
  }

  async healthCheck(req: HealthCheckRequest): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    try {
      const apiKey = req.apiKey?.trim() || await this.getApiKey(req.provider);
      const url = this.toModelsUrl(req.baseUrl);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 'error',
          message: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as ModelsApiResponse;
      const models = this.parseModelsResponse(data);
      const latency = Date.now() - startTime;

      this.modelCache.set(req.baseUrl, { models, timestamp: Date.now() });

      return {
        status: 'ok',
        message: `Connected successfully (${latency}ms)`,
        latency,
        models,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }

  private parseModelsResponse(data: ModelsApiResponse): ModelInfo[] {
    const models = data.data ?? data.models ?? [];
    return models.map((m) => ({
      id: m.id ?? m.model ?? m.name ?? 'unknown',
      contextWindow: m.context_length ?? m.max_tokens ?? undefined,
    }));
  }

  async discoverModels(provider: string, baseUrl: string): Promise<ModelInfo[]> {
    const cached = this.modelCache.get(baseUrl);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.models;
    }

    const apiKey = await this.getApiKey(provider);
    const result = await this.healthCheck({ provider, apiKey, baseUrl });
    return result.models ?? [];
  }

  async testRequest(req: TestRequestPayload): Promise<unknown> {
    const url = this.toChatCompletionsUrl(req.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(30000),
    });
    const raw = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `HTTP ${response.status}: ${raw}`,
      );
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException(
        `HTTP ${response.status}: non-JSON response from upstream`,
      );
    }
  }
}
