const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// Characters
export const characterApi = {
  getAll: () => request<Character[]>('/characters'),
  getOne: (id: number) => request<Character>(`/characters/${id}`),
  create: (data: Partial<Character>) =>
    request<Character>('/characters', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Character>) =>
    request<Character>(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<Character>(`/characters/${id}`, { method: 'DELETE' }),
};

// Chats
export const chatApi = {
  getByCharacter: (characterId: number) =>
    request<Chat[]>(`/chats?characterId=${characterId}`),
  getOne: (id: number) => request<Chat>(`/chats/${id}`),
  create: (characterId: number, name?: string) =>
    request<Chat>('/chats', { method: 'POST', body: JSON.stringify({ characterId, name }) }),
  delete: (id: number) => request<Chat>(`/chats/${id}`, { method: 'DELETE' }),
  getMessages: (chatId: number) => request<Message[]>(`/chats/${chatId}/messages`),
  addMessage: (chatId: number, data: { role: string; content: string; name?: string }) =>
    request<Message>(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  updateMessage: (messageId: number, data: Partial<Message>) =>
    request<Message>(`/chats/messages/${messageId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMessage: (messageId: number) =>
    request<Message>(`/chats/messages/${messageId}`, { method: 'DELETE' }),
};

// AI
export const aiApi = {
  chat: (data: CompletionRequest) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
  streamChat: async function* (data: CompletionRequest) {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, stream: true }),
    });
    if (!res.ok) throw new Error(`Stream error: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.content) yield parsed.content as string;
        } catch (e) {
          if (e instanceof Error && e.message !== data) throw e;
        }
      }
    }
  },
};

// Secrets
export const secretApi = {
  listKeys: () => request<string[]>('/secrets'),
  set: (key: string, value: string) =>
    request('/secrets', { method: 'POST', body: JSON.stringify({ key, value }) }),
  delete: (key: string) => request(`/secrets/${key}`, { method: 'DELETE' }),
};

// Presets
export const presetApi = {
  getAll: (apiType?: string) =>
    request<Preset[]>(`/presets${apiType ? `?apiType=${apiType}` : ''}`),
  getOne: (id: number) => request<Preset>(`/presets/${id}`),
  create: (data: { name: string; apiType: string; data: string }) =>
    request<Preset>('/presets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Preset>) =>
    request<Preset>(`/presets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<Preset>(`/presets/${id}`, { method: 'DELETE' }),
};

// Settings
export const settingsApi = {
  getAll: () => request<Record<string, unknown>>('/settings'),
  get: (key: string) => request(`/settings/${key}`),
  set: (key: string, value: unknown) =>
    request('/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),
};

// Types
export interface Character {
  id: number;
  name: string;
  avatar: string | null;
  description: string;
  personality: string;
  firstMes: string;
  mesExample: string;
  scenario: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creator: string;
  creatorNotes: string;
  tags: string;
  spec: string;
  specVersion: string;
  extensions: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: number;
  characterId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  chatId: number;
  role: 'user' | 'assistant' | 'system';
  name: string;
  content: string;
  isHidden: boolean;
  swipeId: number;
  swipes: string;
  extra: string;
  createdAt: string;
}

export interface Preset {
  id: number;
  name: string;
  apiType: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionRequest {
  provider: string;
  model: string;
  messages: { role: string; content: string; name?: string }[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  stop?: string[];
  reverseProxy?: string;
  chatId?: number;
  saveToDB?: boolean;
}
