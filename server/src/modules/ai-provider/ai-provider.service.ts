import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SecretService } from '../secret/secret.service';
import { LocalEmbeddingService } from './local-embedding.service';
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
  JsonObject,
} from './types';
import { generateText, streamText, embedMany, type ModelMessage } from 'ai';
import type { ZodType } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { tryParsePartialJson } from './json-stream-parser';

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
    { id: 'gpt-5.2', contextWindow: 400_000 },
    { id: 'gpt-5-mini', contextWindow: 400_000 },
    { id: 'gpt-5-nano', contextWindow: 400_000 },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', contextWindow: 200_000 },
    { id: 'claude-opus-4-6', contextWindow: 200_000 },
    { id: 'claude-haiku-4-5', contextWindow: 200_000 },
  ],
  google: [
    { id: 'gemini-3-flash-preview', contextWindow: 1_048_576 },
    { id: 'gemini-3-pro-preview', contextWindow: 1_048_576 },
  ],
  openrouter: [
    { id: 'openai/gpt-5.2', contextWindow: 400_000 },
    { id: 'anthropic/claude-sonnet-4-6', contextWindow: 200_000 },
    { id: 'google/gemini-3-flash-preview', contextWindow: 1_048_576 },
  ],
  mistral: [{ id: 'mistral-large-latest', contextWindow: 128_000 }],
  custom: [],
};

type ProviderOptions = Record<string, NonNullable<CompletionRequest['generationConfig']>>;
type EffectiveProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'custom';
const THINKING_TAG_RE = /<(think|thinking)(?:\s[^>]*)?>(?<inner>[\s\S]*?)<\/\1>/gi;
type StreamTextPart = {
  type?: string;
  text?: string;
  textDelta?: string;
  delta?: string;
  finishReason?: string;
  rawFinishReason?: string;
  error?: unknown;
};

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private modelCache = new Map<string, { models: ModelInfo[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly streamDebugEnabled = ['1', 'true', 'yes', 'on'].includes(
    (process.env.CHAT_DEBUG ?? '').toLowerCase(),
  );

  constructor(
    private readonly secretService: SecretService,
    private readonly localEmbedding: LocalEmbeddingService,
  ) {}

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

  private resolveEffectiveProvider(
    provider: string,
    customApiFormat?: CompletionRequest['customApiFormat'],
  ): EffectiveProvider | undefined {
    switch (provider) {
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'mistral':
        return provider;
      case 'openrouter':
        return 'openai';
      case 'custom':
        switch (customApiFormat ?? 'openai-compatible') {
          case 'google':
            return 'google';
          case 'openai':
            return 'openai';
          case 'anthropic':
            return 'anthropic';
          default:
            return 'custom';
        }
      default:
        return undefined;
    }
  }

  private toConfigObject(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return { ...(value as JsonObject) };
  }

  private supportsGeminiThinkingDefaults(model: string): boolean {
    const normalized = model.toLowerCase();
    return normalized.includes('gemini-3') || normalized.includes('gemini-2.5');
  }

  private supportsOpenAIReasoningDefaults(model: string): boolean {
    const normalized = model.toLowerCase();
    return /(^|\/)gpt-5(?:[.-]|$)/.test(normalized) || /(^|\/)o[134](?:[.-]|$)/.test(normalized);
  }

  private extractThinkingBlocks(content: string): { reasoning: string[]; cleaned: string } {
    if (!content) {
      return { reasoning: [], cleaned: content };
    }

    const reasoning: string[] = [];
    const cleaned = content.replace(THINKING_TAG_RE, (_match, _tag, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) {
        reasoning.push(trimmed);
      }
      return '';
    });

    return {
      reasoning,
      cleaned: cleaned.replace(/\n{3,}/g, '\n\n').trim(),
    };
  }

  private applyReasoningDefaults(
    req: CompletionRequest,
  ): NonNullable<CompletionRequest['generationConfig']> | undefined {
    const effectiveProvider = this.resolveEffectiveProvider(req.provider, req.customApiFormat);
    const nextConfig = this.toConfigObject(req.generationConfig) as NonNullable<
      CompletionRequest['generationConfig']
    >;
    if (effectiveProvider === 'google' && 'topK' in nextConfig) {
      delete nextConfig.topK;
    }
    let changed = Object.keys(nextConfig).length > 0;

    if (req.reasoningEffort && nextConfig.reasoningEffort === undefined) {
      nextConfig.reasoningEffort = req.reasoningEffort;
      changed = true;
    }

    switch (effectiveProvider) {
      case 'openai': {
        if (this.supportsOpenAIReasoningDefaults(req.model)) {
          if (nextConfig.reasoningSummary === undefined) {
            nextConfig.reasoningSummary = 'detailed';
            changed = true;
          }
          if (nextConfig.reasoningEffort === undefined) {
            nextConfig.reasoningEffort = 'medium';
            changed = true;
          }
        }
        break;
      }
      case 'google': {
        if (!this.supportsGeminiThinkingDefaults(req.model)) {
          break;
        }

        const thinkingConfig = this.toConfigObject(nextConfig.thinkingConfig);
        let thinkingChanged = Object.keys(thinkingConfig).length > 0;
        if (thinkingConfig.includeThoughts === undefined) {
          thinkingConfig.includeThoughts = true;
          thinkingChanged = true;
        }

        const normalizedModel = req.model.toLowerCase();
        if (
          normalizedModel.includes('gemini-3') &&
          thinkingConfig.thinkingLevel === undefined &&
          thinkingConfig.thinkingBudget === undefined
        ) {
          thinkingConfig.thinkingLevel = 'medium';
          thinkingChanged = true;
        }

        if (
          normalizedModel.includes('gemini-2.5') &&
          thinkingConfig.thinkingBudget === undefined &&
          thinkingConfig.thinkingLevel === undefined
        ) {
          thinkingConfig.thinkingBudget = 8192;
          thinkingChanged = true;
        }

        if (thinkingChanged) {
          nextConfig.thinkingConfig = thinkingConfig;
          changed = true;
        }
        break;
      }
      case 'custom': {
        if (nextConfig.reasoningEffort === undefined) {
          nextConfig.reasoningEffort = 'medium';
          changed = true;
        }
        break;
      }
      default:
        break;
    }

    return changed ? nextConfig : undefined;
  }

  private getProviderOptionKey(req: CompletionRequest): string | undefined {
    const effectiveProvider = this.resolveEffectiveProvider(req.provider, req.customApiFormat);
    switch (effectiveProvider) {
      case 'openai':
        return 'openai';
      case 'anthropic':
        return 'anthropic';
      case 'google':
        return 'google';
      case 'mistral':
        return 'mistral';
      case 'custom':
        return 'custom';
      default:
        return undefined;
    }
  }

  private getReasoningText(part: {
    delta?: string;
    textDelta?: string;
    text?: string;
  }): string | undefined {
    return part.text ?? part.textDelta ?? part.delta;
  }

  private getStreamPartText(part: StreamTextPart): string | undefined {
    return part.text ?? part.textDelta ?? part.delta;
  }

  private logStreamEvent(kind: 'streamComplete' | 'streamStructured', part: StreamTextPart): void {
    if (!this.streamDebugEnabled) return;

    const type = part.type ?? 'unknown';
    if (
      ![
        'start-step',
        'finish-step',
        'finish',
        'error',
        'raw',
        'source',
        'tool-call',
        'tool-result',
      ].includes(type)
    ) {
      return;
    }

    this.logger.debug(
      `[${kind}] stream event ${JSON.stringify({
        type,
        hasText: Boolean(this.getStreamPartText(part)),
        finishReason: part.finishReason ?? part.rawFinishReason,
        hasError: part.error !== undefined,
      })}`,
    );
  }

  /**
   * Boundary adaptation for @ai-sdk/google: the UI and request body may still carry `topK`
   * (presets, user tuning, switching providers) — we only strip it at the SDK boundary so
   * Gemini never receives unsupported options; this is not "disabling" user preference in
   * storage, only omitting fields the Google API does not accept.
   */
  private usesGoogleGenerativeLanguageModel(req: CompletionRequest): boolean {
    return this.resolveEffectiveProvider(req.provider, req.customApiFormat) === 'google';
  }

  /** Sampling fields passed to generateText / streamText (provider-specific omissions). */
  private buildLanguageModelSampling(req: CompletionRequest): {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  } {
    const base = {
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      topP: req.topP,
      frequencyPenalty: req.frequencyPenalty ?? undefined,
      presencePenalty: req.presencePenalty ?? undefined,
      stopSequences: req.stop,
    };
    if (this.usesGoogleGenerativeLanguageModel(req)) {
      return base;
    }
    return {
      ...base,
      topK: req.topK ?? undefined,
    };
  }

  private createLanguageModel(
    provider: string,
    model: string,
    apiKey: string,
    reverseProxy?: string,
    customApiFormat?: string,
  ) {
    switch (provider) {
      case 'openai':
        return createOpenAI({ apiKey, baseURL: reverseProxy })(model);
      case 'anthropic':
        return createAnthropic({ apiKey, baseURL: reverseProxy })(model);
      case 'google': {
        let googleBase = reverseProxy;
        if (googleBase && !googleBase.endsWith('/v1beta')) {
          googleBase = `${googleBase.replace(/\/v1\/?$|\/+$/, '')}/v1beta`;
        }
        return createGoogleGenerativeAI({ apiKey, baseURL: googleBase })(model);
      }
      case 'openrouter':
        return createOpenAI({
          apiKey,
          baseURL: reverseProxy || 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5000',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'Arctravern',
          },
        })(model);
      case 'mistral':
        return createMistral({ apiKey, baseURL: reverseProxy })(model);
      case 'custom': {
        const format = customApiFormat ?? 'openai-compatible';
        const baseURL = this.normalizeBaseUrl(reverseProxy!);
        switch (format) {
          case 'google': {
            // Google native SDK expects baseURL ending with /v1beta; force it
            const googleBase = baseURL.endsWith('/v1beta')
              ? baseURL
              : `${baseURL.replace(/\/v1\/?$|\/+$/, '')}/v1beta`;
            return createGoogleGenerativeAI({ apiKey, baseURL: googleBase })(model);
          }
          case 'openai':
            return createOpenAI({ apiKey, baseURL })(model);
          case 'anthropic':
            return createAnthropic({ apiKey, baseURL })(model);
          default:
            return createOpenAICompatible({ name: 'custom', apiKey, baseURL })(model);
        }
      }
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
        return createMistral({ apiKey }).textEmbeddingModel(model || 'mistral-embed');
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

  private getProviderOptions(req: CompletionRequest): ProviderOptions | undefined {
    const providerKey = this.getProviderOptionKey(req);
    if (!providerKey) {
      return undefined;
    }

    const nextConfig = this.applyReasoningDefaults(req);
    if (!nextConfig || Object.keys(nextConfig).length === 0) {
      return undefined;
    }

    const payload = { ...(nextConfig as Record<string, unknown>) };
    if (this.usesGoogleGenerativeLanguageModel(req)) {
      delete payload.topK;
    }

    if (Object.keys(payload).length === 0) {
      return undefined;
    }

    return {
      [providerKey]: payload as NonNullable<CompletionRequest['generationConfig']>,
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createLanguageModel(
      req.provider,
      req.model,
      apiKey,
      req.reverseProxy,
      req.customApiFormat,
    );

    const result = await generateText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      ...this.buildLanguageModelSampling(req),
      providerOptions: this.getProviderOptions(req),
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
    const model = this.createLanguageModel(
      req.provider,
      req.model,
      apiKey,
      req.reverseProxy,
      req.customApiFormat,
    );

    const result = streamText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      ...this.buildLanguageModelSampling(req),
      abortSignal: signal,
      providerOptions: this.getProviderOptions(req),
    });

    const seenTypes = new Set<string>();
    let emittedContent = false;
    for await (const part of result.fullStream) {
      const chunk = part as StreamTextPart;
      const chunkType = chunk.type ?? 'unknown';
      seenTypes.add(chunkType);
      this.logStreamEvent('streamComplete', chunk);

      if (chunkType === 'text-delta') {
        const content = this.getStreamPartText(chunk);
        if (content) {
          emittedContent = true;
          yield { content };
        }
        continue;
      }
      if (chunkType === 'reasoning-delta') {
        const reasoningText = this.getReasoningText(chunk);
        if (reasoningText) {
          emittedContent = true;
          yield { reasoning: reasoningText };
        }
        continue;
      }
      if (chunkType === 'text') {
        const content = this.getStreamPartText(chunk);
        if (content) {
          emittedContent = true;
          yield { content };
        }
        continue;
      }
      if (chunkType === 'reasoning') {
        const reasoningText = this.getReasoningText(chunk);
        if (reasoningText) {
          emittedContent = true;
          yield { reasoning: reasoningText };
        }
      }
    }

    if (!emittedContent && seenTypes.size > 0) {
      this.logger.warn(
        `[streamComplete] stream emitted no text or reasoning; seen chunk types=${[...seenTypes].join(',')}`,
      );
    }
  }

  async *streamStructured<T>(
    req: CompletionRequest,
    schema: ZodType<T>,
    signal?: AbortSignal,
  ): AsyncGenerator<
    { partial: unknown; reasoning?: undefined } | { reasoning: string; partial?: undefined },
    void,
    unknown
  > {
    const apiKey = await this.getApiKey(req.provider);
    const model = this.createLanguageModel(
      req.provider,
      req.model,
      apiKey,
      req.reverseProxy,
      req.customApiFormat,
    );

    // Text stream + incremental JSON parsing
    // System prompt (injected by controller) guides the model to output valid JSON.
    const result = streamText({
      model,
      messages: this.convertMessages(req.messages, req.assistantPrefill),
      ...this.buildLanguageModelSampling(req),
      abortSignal: signal,
      providerOptions: this.getProviderOptions(req),
    });

    let fullText = '';
    let hasNativeReasoning = false;
    let emittedContent = false;
    const seenTypes = new Set<string>();
    for await (const part of result.fullStream) {
      const chunk = part as StreamTextPart;
      const chunkType = chunk.type ?? 'unknown';
      seenTypes.add(chunkType);
      this.logStreamEvent('streamStructured', chunk);

      // Reasoning chunks — pass through for the controller to handle
      if (chunkType === 'reasoning-delta') {
        const reasoningText = this.getReasoningText(chunk);
        if (reasoningText) {
          hasNativeReasoning = true;
          emittedContent = true;
          yield { reasoning: reasoningText };
        }
        continue;
      }
      if (chunkType === 'reasoning') {
        const reasoningText = this.getReasoningText(chunk);
        if (reasoningText) {
          hasNativeReasoning = true;
          emittedContent = true;
          yield { reasoning: reasoningText };
        }
        continue;
      }

      // Text chunks — extract <think>/<thinking> blocks, then parse remaining as JSON
      const deltaText = this.getStreamPartText(chunk);
      if ((chunkType === 'text-delta' || chunkType === 'text') && deltaText) {
        fullText += deltaText;
        const extracted = this.extractThinkingBlocks(fullText);
        if (extracted.reasoning.length > 0) {
          if (!hasNativeReasoning) {
            for (const thinkContent of extracted.reasoning) {
              emittedContent = true;
              yield { reasoning: thinkContent };
            }
          }
          fullText = extracted.cleaned;
        }

        const parsed = tryParsePartialJson(fullText);
        if (parsed) {
          emittedContent = true;
          yield { partial: parsed };
        }
      }
    }

    if (!emittedContent && seenTypes.size > 0) {
      this.logger.warn(
        `[streamStructured] stream emitted no partials or reasoning; seen chunk types=${[...seenTypes].join(',')}`,
      );
    }
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (req.provider === 'local') {
      const result = await this.localEmbedding.embed(req.input);
      return {
        embeddings: result.embeddings,
        model: 'jina-embeddings-v2-base-zh',
        dimensions: result.dimensions,
      };
    }

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
    const text =
      input.text ?? input.messages?.map((msg) => this.messageToText(msg)).join('\n') ?? '';
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
        typeof part === 'string' ? part : (part.text ?? JSON.stringify(part)).toString(),
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
      const apiKey = req.apiKey?.trim() || (await this.getApiKey(req.provider));
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
      throw new BadRequestException(`HTTP ${response.status}: ${raw}`);
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException(`HTTP ${response.status}: non-JSON response from upstream`);
    }
  }
}
