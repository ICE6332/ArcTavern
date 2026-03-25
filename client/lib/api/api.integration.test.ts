import { describe, expect, it } from "vitest";
import { characterApi as barrelCharacterApi, chatApi as barrelChatApi, getApiBase } from "../api";
import { characterApi } from "./character";
import { chatApi } from "./chat";
import { getApiBase as directGetApiBase } from "./core/http";

describe("api compatibility barrel", () => {
  it("re-exports domain clients", () => {
    expect(barrelCharacterApi).toBe(characterApi);
    expect(barrelChatApi).toBe(chatApi);
  });

  it("re-exports shared helpers", () => {
    expect(getApiBase).toBe(directGetApiBase);
  });
});
