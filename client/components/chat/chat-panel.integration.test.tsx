import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./chat-panel";

const { chatState, useChatStoreMock } = vi.hoisted(() => {
  const state = {
    chats: [{ id: 5, characterId: 1, name: "Main", createdAt: "", updatedAt: "" }],
    currentChatId: 5,
    messages: [
      {
        id: 2,
        chatId: 5,
        role: "assistant" as const,
        name: "Guide",
        content: "{not-json}",
        reasoning: undefined,
        reasoningSwipes: undefined,
        structuredContent: {
          blocks: [{ role: "narration" as const, text: "Structured hello" }],
        },
        isHidden: false,
        swipeId: 0,
        swipes: [],
        genStarted: null,
        genFinished: null,
        extra: { format: "structured" },
        createdAt: "",
      },
    ],
    isGenerating: false,
    generationType: null,
    streamingContent: "",
    streamingReasoning: "",
    streamingStructured: null,
    error: null,
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    generateSwipe: vi.fn(),
    continueMessage: vi.fn(),
    impersonate: vi.fn(),
    swipe: vi.fn(),
    deleteMessage: vi.fn(),
    refreshCurrentChat: vi.fn(),
    selectChat: vi.fn(),
    createChat: vi.fn(),
    deleteChat: vi.fn(),
  };

  return {
    chatState: state,
    useChatStoreMock: Object.assign(
      (selector?: (store: typeof state) => unknown) => (selector ? selector(state) : state),
      {
        getState: () => state,
      },
    ),
  };
});

vi.mock("@/stores/chat-store", () => ({
  useChatStore: useChatStoreMock,
}));

vi.mock("@/stores/character-store", () => ({
  useCharacterStore: (
    selector?: (state: {
      selectedId: number | null;
      characters: Array<{ id: number; name: string }>;
      createCharacter: () => Promise<{ id: number }>;
      fetchCharacters: () => Promise<void>;
    }) => unknown,
  ) => {
    const state = {
      selectedId: 1,
      characters: [{ id: 1, name: "Astra" }],
      createCharacter: async () => ({ id: 1 }),
      fetchCharacters: async () => undefined,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (
    selector?: (state: {
      provider: string;
      model: string;
      temperature: number;
      maxTokens: number;
      topP: number;
      topK: number;
      frequencyPenalty: number;
      presencePenalty: number;
      reverseProxy: string;
      maxContext: number;
      openUiEnabled: boolean;
      customApiFormat: string;
    }) => unknown,
  ) => {
    const state = {
      provider: "openai" as const,
      model: "gpt-4o" as const,
      temperature: 0.7 as const,
      maxTokens: 512 as const,
      topP: 1 as const,
      topK: 0 as const,
      frequencyPenalty: 0 as const,
      presencePenalty: 0 as const,
      reverseProxy: "",
      maxContext: 4096 as const,
      openUiEnabled: false as const,
      customApiFormat: "openai-compatible" as const,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock("@/stores/prompt-manager-store", () => ({
  usePromptManagerStore: (selector?: (state: { components: [] }) => unknown) =>
    selector ? selector({ components: [] }) : { components: [] },
}));

vi.mock("@/stores/quick-reply-store", () => ({
  useQuickReplyStore: (
    selector?: (state: { loaded: boolean; loadSets: () => Promise<void> }) => unknown,
  ) =>
    selector
      ? selector({ loaded: true, loadSets: async () => undefined })
      : { loaded: true, loadSets: async () => undefined },
}));

vi.mock("@/stores/variable-store", () => ({
  useVariableStore: (
    selector?: (state: {
      loadGlobalVariables: () => Promise<void>;
      loadChatVariables: () => Promise<void>;
    }) => unknown,
  ) =>
    selector
      ? selector({
          loadGlobalVariables: async () => undefined,
          loadChatVariables: async () => undefined,
        })
      : {
          loadGlobalVariables: async () => undefined,
          loadChatVariables: async () => undefined,
        },
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock("@/components/chat/quick-reply-bar", () => ({
  QuickReplyBar: () => <div data-testid="quick-reply-bar" />,
}));

vi.mock("./chat-message-row", () => ({
  ChatMessageRow: ({ message }: { message: (typeof chatState.messages)[number] }) => (
    <div data-testid="chat-message-row">
      {message.structuredContent?.blocks?.[0]?.role === "narration"
        ? message.structuredContent.blocks[0].text
        : message.content}
    </div>
  ),
}));

vi.mock("./message-bubble", () => ({
  MessageBubble: ({ content }: { content: string }) => (
    <div data-testid="message-bubble">{content}</div>
  ),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ toggleSidebar: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/openui", () => ({
  getOpenUiSystemPrompt: () => "OpenUI system prompt",
}));

describe("ChatPanel integration", () => {
  it("renders pre-parsed structured content without relying on render-time JSON parsing", () => {
    render(<ChatPanel />);

    expect(chatState.messages[0].content).toBe("{not-json}");
    expect(screen.getByText("Structured hello")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });
});
