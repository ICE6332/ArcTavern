import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsPanelController } from "@/hooks/use-settings-panel-controller";
import { useConnectionStore } from "@/stores/connection-store";

const { completeMock, listKeysMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  listKeysMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/lib/api/ai", () => ({
  aiApi: {
    complete: completeMock,
  },
}));

vi.mock("@/lib/api/secret", () => ({
  secretApi: {
    listKeys: listKeysMock,
    set: vi.fn(),
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("useSettingsPanelController", () => {
  beforeEach(() => {
    localStorage.clear();
    completeMock.mockReset();
    listKeysMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    listKeysMock.mockResolvedValue(["api_key_custom"]);
    completeMock.mockResolvedValue({
      content: "OK",
      model: "gemini-3-flash-preview",
      finishReason: "stop",
    });

    useConnectionStore.setState({
      provider: "custom",
      model: "gemini-3-flash-preview",
      reverseProxy: "https://example.com/v1beta",
      customModels: ["gemini-3-flash-preview"],
      customApiFormat: "google",
      topK: 40,
      frequencyPenalty: 0,
      presencePenalty: 0,
      connectionStatus: "idle",
      connectionMessage: null,
      apiKeyConfigured: {
        openai: false,
        anthropic: false,
        google: false,
        openrouter: false,
        mistral: false,
        custom: true,
      },
    });
  });

  it("passes customApiFormat and omits topK for custom google test requests", async () => {
    const { result } = renderHook(() => useSettingsPanelController((key) => key));

    await waitFor(() => {
      expect(listKeysMock).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "custom",
        model: "gemini-3-flash-preview",
        reverseProxy: "https://example.com/v1beta",
        customApiFormat: "google",
        topK: undefined,
      }),
    );
  });
});
