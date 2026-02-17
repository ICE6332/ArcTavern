/** Original ST chat_completion_source → rewrite provider */
export const ST_SOURCE_TO_PROVIDER: Record<string, string> = {
  openai: 'openai',
  chatgpt: 'openai',
  claude: 'anthropic',
  google: 'google',
  makersuite: 'google',
  openrouter: 'openrouter',
  mistralai: 'mistral',
  custom: 'custom',
  ai21: 'custom',
  cohere: 'custom',
  perplexity: 'custom',
  groq: 'custom',
  deepseek: 'custom',
  xai: 'custom',
  chutes: 'custom',
  electronhub: 'custom',
};

/** Original ST model field name → rewrite provider */
export const MODEL_FIELD_TO_PROVIDER: Record<string, string> = {
  openai_model: 'openai',
  claude_model: 'anthropic',
  google_model: 'google',
  vertexai_model: 'google',
  openrouter_model: 'openrouter',
  mistralai_model: 'mistral',
  custom_model: 'custom',
};

/**
 * Extract the active provider and model from an OpenAI preset's data blob.
 */
export function resolveProviderAndModel(
  presetData: Record<string, unknown>,
): { provider: string; model: string } {
  const source = (presetData.chat_completion_source as string) ?? 'openai';
  const provider = ST_SOURCE_TO_PROVIDER[source] ?? 'custom';

  const modelFieldMap: Record<string, string> = {
    openai: 'openai_model',
    anthropic: 'claude_model',
    google: 'google_model',
    openrouter: 'openrouter_model',
    mistral: 'mistralai_model',
    custom: 'custom_model',
  };

  const modelField = modelFieldMap[provider] ?? 'custom_model';
  const model = (presetData[modelField] as string) ?? '';

  return { provider, model };
}
