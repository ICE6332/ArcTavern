/**
 * I18N migration notes for settings-panel.tsx
 *
 * 1. Import `useTranslations` from `next-intl`.
 * 2. Inside the component body, call:
 *    `const t = useTranslations("settings");`
 * 3. Replace hardcoded strings:
 *    - `<Label>Provider</Label>` -> `<Label>{t("provider")}</Label>`
 *    - `<Button>Save</Button>` -> `<Button>{t("save")}</Button>`
 * 4. Add language switcher where needed:
 *    `<LanguageSwitcher />`
 */
export function SettingsPanelI18nExample() {
  return null;
}
