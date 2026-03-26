/// <reference types="vitest/globals" />
import { RagService } from './rag.service';
import type { RagSettings } from './types';
import { DEFAULT_RAG_SETTINGS } from './types';

function makeMocks() {
  const aiProvider = {
    embed: vi.fn(),
  };
  const vectorStore = {
    search: vi.fn(),
    tableExists: vi.fn(),
    addRecords: vi.fn(),
    deleteByMessageId: vi.fn(),
    deleteByChatId: vi.fn(),
    deleteByCharacterId: vi.fn(),
  };
  const embedder = {
    enqueue: vi.fn(),
  };
  const settingsService = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const service = new RagService(
    aiProvider as any,
    vectorStore as any,
    embedder as any,
    settingsService as any,
  );

  return { service, aiProvider, vectorStore, embedder, settingsService };
}

describe('RagService', () => {
  describe('getSettings', () => {
    it('returns defaults when no settings stored', async () => {
      const { service, settingsService } = makeMocks();
      settingsService.get.mockResolvedValue(null);

      const result = await service.getSettings();
      expect(result).toEqual(DEFAULT_RAG_SETTINGS);
    });

    it('merges stored settings with defaults', async () => {
      const { service, settingsService } = makeMocks();
      settingsService.get.mockResolvedValue(JSON.stringify({ enabled: true, maxResults: 20 }));

      const result = await service.getSettings();
      expect(result.enabled).toBe(true);
      expect(result.maxResults).toBe(20);
      expect(result.scope).toBe('character'); // default
    });
  });

  describe('saveSettings', () => {
    it('merges and persists settings', async () => {
      const { service, settingsService } = makeMocks();
      settingsService.get.mockResolvedValue(null);

      const result = await service.saveSettings({ enabled: true });
      expect(settingsService.set).toHaveBeenCalledWith(
        'rag_settings',
        expect.stringContaining('"enabled":true'),
      );
      expect(result.enabled).toBe(true);
      expect(result.scope).toBe('character');
    });
  });

  describe('onMessagePersisted', () => {
    it('does nothing when disabled', () => {
      const { service, embedder } = makeMocks();
      const settings: RagSettings = { ...DEFAULT_RAG_SETTINGS, enabled: false };

      service.onMessagePersisted(
        { id: 1, chat_id: 1, role: 'user', name: '', content: 'hi', created_at: '' },
        1,
        settings,
      );

      expect(embedder.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues user/assistant messages when enabled', () => {
      const { service, embedder } = makeMocks();
      const settings: RagSettings = { ...DEFAULT_RAG_SETTINGS, enabled: true };

      service.onMessagePersisted(
        { id: 1, chat_id: 1, role: 'user', name: 'User', content: 'hello', created_at: '' },
        5,
        settings,
      );

      expect(embedder.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, role: 'user' }),
        5,
        settings,
      );
    });

    it('ignores system messages', () => {
      const { service, embedder } = makeMocks();
      const settings: RagSettings = { ...DEFAULT_RAG_SETTINGS, enabled: true };

      service.onMessagePersisted(
        { id: 1, chat_id: 1, role: 'system', name: '', content: 'sys', created_at: '' },
        1,
        settings,
      );

      expect(embedder.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('retrieveMemories', () => {
    it('returns empty when disabled', async () => {
      const { service } = makeMocks();
      const settings: RagSettings = { ...DEFAULT_RAG_SETTINGS, enabled: false };

      const result = await service.retrieveMemories([{ content: 'hello' }], 1, 1, settings);
      expect(result).toEqual([]);
    });

    it('returns empty when no table exists', async () => {
      const { service, aiProvider, vectorStore } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
      };

      aiProvider.embed.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        dimensions: 2,
        model: 'test',
      });
      vectorStore.tableExists.mockResolvedValue(false);

      const result = await service.retrieveMemories([{ content: 'hello' }], 1, 1, settings);
      expect(result).toEqual([]);
    });

    it('retrieves and filters memories by score', async () => {
      const { service, aiProvider, vectorStore } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
        minScore: 0.5,
        maxResults: 10,
      };

      aiProvider.embed.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        dimensions: 2,
        model: 'test',
      });
      vectorStore.tableExists.mockResolvedValue(true);
      vectorStore.search.mockResolvedValue([
        {
          content: 'good match',
          role: 'user',
          name: 'User',
          messageId: 1,
          chatId: 1,
          createdAt: '',
          _distance: 0.2,
        },
        {
          content: 'bad match',
          role: 'user',
          name: 'User',
          messageId: 2,
          chatId: 1,
          createdAt: '',
          _distance: 0.8,
        },
      ]);

      const result = await service.retrieveMemories([{ content: 'hello' }], 1, 1, settings);

      expect(result.length).toBe(1);
      expect(result[0].content).toBe('good match');
      expect(result[0].score).toBeCloseTo(0.8);
    });

    it('deduplicates by messageId keeping highest score', async () => {
      const { service, aiProvider, vectorStore } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
        minScore: 0.0,
        maxResults: 10,
      };

      aiProvider.embed.mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        dimensions: 2,
        model: 'test',
      });
      vectorStore.tableExists.mockResolvedValue(true);
      vectorStore.search.mockResolvedValue([
        {
          content: 'chunk1',
          role: 'assistant',
          name: 'Bot',
          messageId: 5,
          chatId: 1,
          createdAt: '',
          _distance: 0.1,
        },
        {
          content: 'chunk2',
          role: 'assistant',
          name: 'Bot',
          messageId: 5,
          chatId: 1,
          createdAt: '',
          _distance: 0.3,
        },
      ]);

      const result = await service.retrieveMemories([{ content: 'hello' }], 1, 1, settings);

      expect(result.length).toBe(1);
      expect(result[0].content).toBe('chunk1');
      expect(result[0].score).toBeCloseTo(0.9);
    });

    it('gracefully handles errors', async () => {
      const { service, aiProvider } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
      };

      aiProvider.embed.mockRejectedValue(new Error('API down'));

      const result = await service.retrieveMemories([{ content: 'hello' }], 1, 1, settings);
      expect(result).toEqual([]);
    });

    it('uses chat scope filter', async () => {
      const { service, aiProvider, vectorStore } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
        scope: 'chat',
      };

      aiProvider.embed.mockResolvedValue({
        embeddings: [[0.1]],
        dimensions: 1,
        model: 'test',
      });
      vectorStore.tableExists.mockResolvedValue(true);
      vectorStore.search.mockResolvedValue([]);

      await service.retrieveMemories([{ content: 'hello' }], 1, 42, settings);

      expect(vectorStore.search).toHaveBeenCalledWith([0.1], 1, 'chatId = 42', expect.any(Number));
    });

    it('uses character scope filter', async () => {
      const { service, aiProvider, vectorStore } = makeMocks();
      const settings: RagSettings = {
        ...DEFAULT_RAG_SETTINGS,
        enabled: true,
        embeddingProvider: 'openai',
        scope: 'character',
      };

      aiProvider.embed.mockResolvedValue({
        embeddings: [[0.1]],
        dimensions: 1,
        model: 'test',
      });
      vectorStore.tableExists.mockResolvedValue(true);
      vectorStore.search.mockResolvedValue([]);

      await service.retrieveMemories([{ content: 'hello' }], 7, 1, settings);

      expect(vectorStore.search).toHaveBeenCalledWith(
        [0.1],
        1,
        'characterId = 7',
        expect.any(Number),
      );
    });
  });
});
