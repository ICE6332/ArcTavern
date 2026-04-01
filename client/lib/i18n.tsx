import { useLanguageStore } from "@/stores/language-store";
import enTranslations from "@/locales/en/common.json";
import zhTranslations from "@/locales/zh/common.json";

const translations = {
  en: enTranslations,
  zh: zhTranslations,
};

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const overrides: Record<string, string> = {
    "en:chat.reasoning": "Thinking...",
    "zh:chat.reasoning": "思考...",
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const override = overrides[`${language}:${key}`];
    if (override) {
      return override;
    }

    const keys = key.split(".");
    let value: unknown = translations[language];

    for (const k of keys) {
      if (!value || typeof value !== "object") {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[k];
    }

    let result = typeof value === "string" ? value : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replaceAll(`{${k}}`, v);
      }
    }
    return result;
  };

  return { t, language };
}
