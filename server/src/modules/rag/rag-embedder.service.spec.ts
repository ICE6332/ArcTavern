/// <reference types="vitest/globals" />
import { RagEmbedderService } from './rag-embedder.service';

describe('RagEmbedderService', () => {
  describe('chunkText', () => {
    const embedder = new RagEmbedderService({} as any, {} as any);

    it('returns empty array for empty text', () => {
      expect(embedder.chunkText('', 1000, 200)).toEqual([]);
      expect(embedder.chunkText('   ', 1000, 200)).toEqual([]);
    });

    it('returns single chunk for short text', () => {
      const text = 'Hello world';
      expect(embedder.chunkText(text, 1000, 200)).toEqual(['Hello world']);
    });

    it('splits long text into overlapping chunks', () => {
      const text = 'A'.repeat(2500);
      const chunks = embedder.chunkText(text, 1000, 200);

      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(1000);
      expect(chunks[1].length).toBe(1000);
      expect(chunks[2].length).toBe(900); // 2500 - 800 - 800 = 900
    });

    it('handles zero overlap', () => {
      const text = 'A'.repeat(2000);
      const chunks = embedder.chunkText(text, 1000, 0);

      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(1000);
      expect(chunks[1].length).toBe(1000);
    });

    it('handles text exactly at chunk size', () => {
      const text = 'A'.repeat(1000);
      const chunks = embedder.chunkText(text, 1000, 200);

      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(1000);
    });
  });
});
