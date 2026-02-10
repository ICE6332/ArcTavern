import { ProviderAdapter, CompletionRequest, CompletionResponse } from '../types';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';

  buildRequest(req: CompletionRequest, apiKey: string) {
    const url = req.reverseProxy || 'https://api.anthropic.com/v1/messages';

    const systemMessage = req.messages.find((m) => m.role === 'system');
    const nonSystemMessages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: req.model || 'claude-sonnet-4-20250514',
        max_tokens: req.maxTokens ?? 4096,
        ...(systemMessage ? { system: systemMessage.content } : {}),
        messages: nonSystemMessages,
        temperature: req.temperature ?? 0.7,
        top_p: req.topP,
        top_k: req.topK,
        stream: req.stream ?? false,
        stop_sequences: req.stop,
      },
    };
  }

  parseResponse(data: any): CompletionResponse {
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      model: data.model ?? '',
      finishReason: data.stop_reason ?? 'end_turn',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  parseStreamChunk(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk);
      if (parsed.type === 'content_block_delta') {
        return parsed.delta?.text ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
