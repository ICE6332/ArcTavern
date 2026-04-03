/**
 * RPC handlers: character data access.
 */

import { useCharacterStore } from "@/stores/character-store";
import { characterApi } from "@/lib/api/character";
import type { RpcHandler } from "../rpc-registry";

/** getCharacter({ id? }) — returns current character if no id given */
export const getCharacter: RpcHandler = (params, ctx) => {
  const store = useCharacterStore.getState();
  const id = typeof params.id === "number" ? params.id : ctx.characterId;
  const character = store.characters.find((c) => c.id === id);
  if (!character) return null;

  return {
    id: character.id,
    name: character.name,
    avatar: character.avatar,
    description: character.description,
    personality: character.personality,
    firstMes: character.firstMes,
    mesExample: character.mesExample,
    scenario: character.scenario,
    systemPrompt: character.systemPrompt,
    postHistoryInstructions: character.postHistoryInstructions,
    alternateGreetings: character.alternateGreetings,
    creator: character.creator,
    tags: character.tags,
    extensions: character.extensions,
  };
};

/** getCharacterList() */
export const getCharacterList: RpcHandler = () => {
  return useCharacterStore.getState().characters.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    creator: c.creator,
    tags: c.tags,
  }));
};

/** getCurrentCharacterName() */
export const getCurrentCharacterName: RpcHandler = (_params, ctx) => {
  const store = useCharacterStore.getState();
  const character = store.characters.find((c) => c.id === ctx.characterId);
  return character?.name ?? "";
};

/** getCharacterAvatarUrl({ id? }) */
export const getCharacterAvatarUrl: RpcHandler = (params, ctx) => {
  const id = typeof params.id === "number" ? params.id : ctx.characterId;
  if (id == null) return null;
  return characterApi.avatarUrl(id);
};
