import { ProviderAdapter, CompletionRequest, CompletionResponse } from '../types';

export class GoogleAdapter implements ProviderAdapter {
  name = 'google';

  buildRequest(req: CompletionRequest, apiKey: string) {
    const model = req.model || 'gemini-2.0-flash';
    const url =
      req.reverseProxy ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:${req.stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;

    const systemInstruction = req.messages.find((m) => m.role === 'system');
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    return {
      url,
      headers: { 'Content-Type': 'application/json' },
      body: {
        ...(systemInstruction
          ? { system_instruction: { parts: [{ text: systemInstruction.content }] } }
          : {}),
        contents,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 4096,
          topP: req.topP,
          topK: req.topK,
          stopSequences: req.stop,
        },
      },
    };
  }

  parseResponse(data: any): CompletionResponse {
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';
    return {
      content: text,
      model: data.modelVersion ?? '',
      finishReason: candidate?.finishReason ?? 'STOP',
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: data.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  parseStreamChunk(chunk: string): string | null {
    try {
      const parsed = JSON.parse(chunk);
      return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch {
      return null;
    }
  }
}
