const OPENUI_PATTERN = /^\w+\s*=\s*\w+\(/;

export function isOpenUiLang(content: string): boolean {
  return OPENUI_PATTERN.test(content.trimStart());
}
