/** Compat 层入口：regex/XML 预处理 + 助手展示管线（与 `lib/compat/` 配套）。 */

import { useEffect, useMemo } from "react";
import { useCharacterStore } from "@/stores/character-store";
import { useRegexStore } from "@/stores/regex-store";
import { preprocessContent } from "@/lib/compat/preprocessor";
import {
  prepareAssistantDisplay,
  type PreparedAssistantDisplay,
} from "@/lib/compat/display-pipeline";

export function useContentPreprocessor() {
  const characters = useCharacterStore((s) => s.characters);
  const selectedId = useCharacterStore((s) => s.selectedId);
  const globalScripts = useRegexStore((s) => s.globalScripts);
  const loadingGlobalScripts = useRegexStore((s) => s.loading);
  const loadedGlobalScripts = useRegexStore((s) => s.loadedGlobalScripts);
  const fetchGlobalScripts = useRegexStore((s) => s.fetchGlobalScripts);

  const extensions = useMemo(() => {
    if (!selectedId) return null;
    const char = characters.find((c) => c.id === selectedId);
    return char?.extensions ?? null;
  }, [characters, selectedId]);

  useEffect(() => {
    if (!loadedGlobalScripts && !loadingGlobalScripts) {
      void fetchGlobalScripts();
    }
  }, [fetchGlobalScripts, loadedGlobalScripts, loadingGlobalScripts]);

  return useMemo(() => {
    return {
      preprocess: (content: string, role: string): string => {
        if (role !== "assistant" || !content) return content;
        return preprocessContent(content, extensions, globalScripts);
      },
      formatAssistantForDisplay: (content: string): PreparedAssistantDisplay => {
        if (!content) {
          return {
            display: "",
            scripts: [],
            thinking: "",
            segments: [],
            compatData: {},
          };
        }
        const preprocessed = preprocessContent(content, extensions, globalScripts);
        return prepareAssistantDisplay(content, preprocessed);
      },
    };
  }, [extensions, globalScripts]);
}
