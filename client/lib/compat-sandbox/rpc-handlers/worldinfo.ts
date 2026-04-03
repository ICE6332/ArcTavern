/**
 * RPC handlers: world-info / lorebook access (read-only).
 */

import { useWorldInfoStore } from "@/stores/world-info-store";
import { worldInfoApi } from "@/lib/api/world-info";
import type { RpcHandler } from "../rpc-registry";

/** getWorldInfoBooks() */
export const getWorldInfoBooks: RpcHandler = () => {
  return useWorldInfoStore.getState().books.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
  }));
};

/** getWorldInfoEntries({ bookId }) */
export const getWorldInfoEntries: RpcHandler = async (params) => {
  const bookId = typeof params.bookId === "number" ? params.bookId : null;
  if (bookId == null) return [];

  const book = await worldInfoApi.getBook(bookId);
  return book.entries.map((e) => ({
    id: e.id,
    uid: e.uid,
    keys: e.keys,
    secondaryKeys: e.secondaryKeys,
    content: e.content,
    comment: e.comment,
    enabled: e.enabled,
    position: e.position,
    depth: e.depth,
    constant: e.constant,
    selective: e.selective,
    probability: e.probability,
    groupName: e.groupName,
  }));
};

/** getActiveWorldInfoBookIds() */
export const getActiveWorldInfoBookIds: RpcHandler = () => {
  return useWorldInfoStore.getState().activeBookIds;
};
