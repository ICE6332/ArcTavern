import { ProviderAdapter, CompletionRequest, CompletionResponse } from '../types';

export class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';

  buildRequest(req: CompletionRequest, apiKey: string) {
    const url = req.reverseProxy || 'https://api.openai.com/v1/chat/completions';
    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model: req.model || 'gpt-4o',
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens,
        top_p: req.topP,
        frequency_penalty: req.frequencyPenalty,
        presence_penalty: req.presencePenalty,
        stream: req.stream ?? false,
        stop: req.stop,
      },
    };
  }

  parseResponse(data: any): CompletionResponse {
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      model: data.model ?? '',
      finishReason: choice?.finish_reason ?? 'stop',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  parseStreamChunk(chunk: string): string | null {
    if (chunk === '[DONE]') return null;
    try {
      const parsed = JSON.parse(chunk);
      return parsed.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }
}
