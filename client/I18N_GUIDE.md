# i18n Guide

The frontend uses a lightweight client-side i18n setup built on top of:

1. `client/locales/en/common.json`
2. `client/locales/zh/common.json`
3. `client/stores/language-store.ts`
4. `client/lib/i18n.tsx`

## How it works

- The selected language is stored in Zustand and persisted to local storage.
- `useTranslation()` looks up keys from the JSON locale bundles at runtime.
- There is no locale-aware router or URL segment. The app remains a single-page interface.

## Usage

```tsx
import { useTranslation } from "@/lib/i18n";

export function Example() {
  const { t } = useTranslation();

  return <span>{t("settings.language")}</span>;
}
```

## Adding strings

1. Add the new key to `client/locales/en/common.json`.
2. Add the matching translated key to `client/locales/zh/common.json`.
3. Reference it with `t("path.to.key")`.
