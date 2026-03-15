import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const fetchCharacters = vi.fn();
const fetchTags = vi.fn();
const fetchPersonas = vi.fn();

const personaState = {
  activePersonaId: "persona-1",
  fetchPersonas,
  personas: [
    {
      id: "persona-1",
      name: "Guide",
      description: "",
      position: 0,
      depth: 2,
      role: 0,
      lorebookId: null,
      title: null,
      isDefault: true,
      avatarPath: null,
      createdAt: "",
      updatedAt: "",
    },
  ],
};

vi.mock("@/components/chat/chat-panel", () => ({
  ChatPanel: () => <div>chat-panel</div>,
}));

vi.mock("@/components/persona/persona-editor", () => ({
  PersonaEditor: () => <div data-testid="persona-editor">persona-editor</div>,
}));

vi.mock("@/components/persona/persona-selector", () => ({
  PersonaSelector: () => <div>persona-selector</div>,
}));

vi.mock("@/components/settings/settings-panel", () => ({
  SettingsPanel: () => <div>settings-panel</div>,
}));

vi.mock("@/components/sidebar/sidebar", () => ({
  Sidebar: () => <div>sidebar</div>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">toggle-sidebar</button>,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/character-store", () => ({
  useCharacterStore: (selector?: (state: { fetchCharacters: typeof fetchCharacters }) => unknown) =>
    selector ? selector({ fetchCharacters }) : { fetchCharacters },
}));

vi.mock("@/stores/tag-store", () => ({
  useTagStore: (selector?: (state: { fetchTags: typeof fetchTags }) => unknown) =>
    selector ? selector({ fetchTags }) : { fetchTags },
}));

vi.mock("@/stores/persona-store", () => ({
  usePersonaStore: (selector?: (state: typeof personaState) => unknown) =>
    selector ? selector(personaState) : personaState,
}));

vi.mock("sileo", () => ({
  Toaster: () => <div>toaster</div>,
}));

describe("AppShell", () => {
  it("loads the initial data sources and can open the persona editor", async () => {
    const user = userEvent.setup();

    render(<AppShell />);

    await waitFor(() => {
      expect(fetchCharacters).toHaveBeenCalledTimes(1);
      expect(fetchTags).toHaveBeenCalledTimes(1);
      expect(fetchPersonas).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("chat-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("persona-editor")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByTestId("persona-editor")).toBeInTheDocument();
  });
});
