import { useMemo } from "react";
import { useCharacterStore } from "@/stores/character-store";
import type { RuntimeAdapter, RuntimeManifest, RuntimeMode } from "@/lib/compat/runtime-manifest";

export function useRuntimeMode(): {
  runtimeMode: RuntimeMode;
  runtimeManifest: RuntimeManifest | null;
  runtimeAdapter: RuntimeAdapter | null;
} {
  const selectedId = useCharacterStore((s) => s.selectedId);
  const characters = useCharacterStore((s) => s.characters);

  return useMemo(() => {
    const character = characters.find((item) => item.id === selectedId) ?? null;
    const runtimeManifest = (character?.extensions?.runtimeManifest ??
      null) as RuntimeManifest | null;

    return {
      runtimeMode: runtimeManifest?.runtimeMode ?? "native",
      runtimeManifest,
      runtimeAdapter: runtimeManifest?.adapter ?? null,
    };
  }, [characters, selectedId]);
}
