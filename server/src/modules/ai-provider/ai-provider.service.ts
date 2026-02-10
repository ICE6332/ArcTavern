import { Injectable, BadRequestException } from '@nestjs/common';
import { SecretService } from '../secret/secret.service';
import { ProviderAdapter, CompletionRequest, CompletionResponse } from './types';
import { OpenAIAdapter, AnthropicAdapter, GoogleAdapter } from './providers';

const SECRET_KEY_MAP: Record<string, string> = {
  openai: 'api_key_openai',
  anthropic: 'api_key_anthropic',
  google: 'api_key_google',
  openrouter: 'api_key_openrouter',
  mistral: 'api_key_mistral',
  custom: 'api_key_custom',
};

@Injectable()
export class AiProviderService {
  private adapters: Map<string, ProviderAdapter>;

  constructor(private readonly secretService: SecretService) {
    this.adapters = new Map();
    const openai = new OpenAIAdapter();
    const anthropic = new AnthropicAdapter();
    const google = new GoogleAdapter();

    this.adapters.set('openai', openai);
    this.adapters.set('anthropic', anthropic);
    this.adapters.set('google', google);
    // OpenRouter uses OpenAI-compatible API
    this.adapters.set('openrouter', openai);
    // Mistral uses OpenAI-compatible API
    this.adapters.set('mistral', openai);
    // Custom endpoints use OpenAI-compatible API by default
    this.adapters.set('custom', openai);
  }

  getAdapter(provider: string): ProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    return adapter;
  }

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

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const adapter = this.getAdapter(req.provider);
    const apiKey = await this.getApiKey(req.provider);
    const { url, headers, body } = adapter.buildRequest(
      { ...req, stream: false },
      apiKey,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Provider ${req.provider} returned ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json();
    return adapter.parseResponse(data);
  }

  async *streamComplete(
    req: CompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    const adapter = this.getAdapter(req.provider);
    const apiKey = await this.getApiKey(req.provider);
    const { url, headers, body } = adapter.buildRequest(
      { ...req, stream: true },
      apiKey,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Provider ${req.provider} returned ${response.status}: ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new BadRequestException('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'event: ping') continue;

          let data = trimmed;
          if (data.startsWith('data: ')) {
            data = data.slice(6);
          }
          if (data === '[DONE]') return;

          const text = adapter.parseStreamChunk(data);
          if (text) yield text;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
