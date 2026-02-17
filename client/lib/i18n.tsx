import { useLanguageStore } from '@/stores/language-store';
import enTranslations from '@/locales/en/common.json';
import zhTranslations from '@/locales/zh/common.json';

const translations = {
  en: enTranslations,
  zh: zhTranslations,
};

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];

    for (const k of keys) {
      if (!value || typeof value !== 'object') {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[k];
    }

    return typeof value === 'string' ? value : key;
  };

  return { t, language };
}
