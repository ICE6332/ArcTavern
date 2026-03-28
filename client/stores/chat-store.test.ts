import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/lib/api/chat";

const { chatApiMock } = vi.hoisted(() => ({
  chatApiMock: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMessage: vi.fn(),
    generate: vi.fn(),
    getByCharacter: vi.fn(),
    getMessages: vi.fn(),
    stop: vi.fn(),
    swipe: vi.fn(),
  },
}));

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat");

  return {
    ...actual,
    chatApi: chatApiMock,
  };
});

import { useChatStore } from "./chat-store";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createMessageFixture(content: string): Message {
  return {
    id: 9,
    chatId: 3,
    role: "assistant",
    name: "Guide",
    content,
    reasoning: undefined,
    reasoningSwipes: undefined,
    structuredContent: null,
    isHidden: false,
    swipeId: 0,
    swipes: [],
    genStarted: null,
    genFinished: null,
    extra: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("useChatStore", () => {
  let rafQueue: FrameRequestCallback[];

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    useChatStore.setState({
      chats: [],
      currentChatId: 3,
      messages: [],
      isGenerating: false,
      generationType: null,
      streamingContent: "",
      streamingReasoning: "",
      streamingStructured: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("batches multiple stream chunks into a single frame update", async () => {
    const releaseStream = createDeferred();
    chatApiMock.generate.mockImplementation(async function* () {
      yield { content: "Hel" };
      yield { content: "lo" };
      await releaseStream.promise;
    });
    chatApiMock.getMessages.mockResolvedValue([createMessageFixture("Hello")]);

    const promise = useChatStore.getState().sendMessage("hi", {
      provider: "openai",
      model: "gpt-5.2",
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(useChatStore.getState().streamingContent).toBe("");
    expect(rafQueue).toHaveLength(1);

    const frame = rafQueue.shift();
    frame?.(16);

    expect(useChatStore.getState().streamingContent).toBe("Hello");

    releaseStream.resolve();
    await promise;

    expect(useChatStore.getState().streamingContent).toBe("");
    expect(useChatStore.getState().messages).toEqual([createMessageFixture("Hello")]);
  });
});
