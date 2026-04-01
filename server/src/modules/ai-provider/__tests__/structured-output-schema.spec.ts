/// <reference types="vitest/globals" />
import { getStructuredOutputSystemPrompt } from '../structured-output-schema';

describe('Structured output system prompt', () => {
  it('forbids hidden reasoning from appearing in visible blocks', () => {
    const prompt = getStructuredOutputSystemPrompt();

    expect(prompt).toContain('Blocks must contain user-visible content only.');
    expect(prompt).toContain(
      'Do NOT place hidden reasoning, chain-of-thought, internal deliberation, or private analysis inside narration or any other block.',
    );
    expect(prompt).toContain(
      'If the provider has a separate reasoning/thinking channel, use it instead of exposing reasoning in blocks.',
    );
  });
});
