import type { TavernCardV2 } from './character-card-parser.service';

export type RuntimeMode = 'native' | 'compat-sandbox';
export type RuntimeAdapter = 'st-generic' | 'era' | 'fate' | 'custom';

export interface RuntimeCapabilities {
  regex: boolean;
  htmlDocument: boolean;
  script: boolean;
  xmlTags: boolean;
  variableInsert: boolean;
  eraData: boolean;
  placeholder: boolean;
  styledHtml: boolean;
  cssAnimation: boolean;
  externalAsset: boolean;
  lorebookRegex: boolean;
}

export interface RuntimeManifest {
  runtimeMode: RuntimeMode;
  adapter?: RuntimeAdapter;
  promptCompat: boolean;
  renderCompat: boolean;
  capabilities: RuntimeCapabilities;
  detectedFeatures: string[];
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function isRegexLikeKey(value: unknown): boolean {
  return typeof value === 'string' && /^\/.+\/[gimsuy]*$/.test(value.trim());
}

function entryHasRegex(rawEntry: unknown): boolean {
  if (!rawEntry || typeof rawEntry !== 'object') return false;
  const entry = rawEntry as Record<string, unknown>;

  if (entry.use_regex === true || entry.useRegex === true) {
    return true;
  }

  const keyLists = [entry.keys, entry.key, entry.secondary_keys, entry.keysecondary];
  return keyLists.some((list) => {
    if (Array.isArray(list)) {
      return list.some(isRegexLikeKey);
    }
    return isRegexLikeKey(list);
  });
}

function collectCardStrings(card: TavernCardV2): string[] {
  const values: string[] = [
    card.data.first_mes,
    card.data.description,
    card.data.personality,
    card.data.scenario,
    card.data.system_prompt,
    card.data.post_history_instructions,
    card.data.mes_example,
    ...card.data.alternate_greetings,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const bookEntries = Array.isArray(card.data.character_book?.entries)
    ? card.data.character_book.entries
    : [];

  for (const rawEntry of bookEntries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const entry = rawEntry as Record<string, unknown>;
    for (const key of ['content', 'comment']) {
      if (typeof entry[key] === 'string' && entry[key].trim().length > 0) {
        values.push(entry[key]);
      }
    }
  }

  return values;
}

function collectDetectedFeatures(
  regexScripts: Array<Record<string, unknown>>,
  capabilities: RuntimeCapabilities,
): string[] {
  const detected: string[] = [];

  if (capabilities.regex) detected.push(`regex_scripts:${regexScripts.length}`);
  if (capabilities.htmlDocument) detected.push('html_document_output');
  if (capabilities.script) detected.push('script_blocks');
  if (capabilities.variableInsert) detected.push('variable_insert');
  if (capabilities.eraData) detected.push('era_data');
  if (capabilities.placeholder) detected.push('status_placeholder');
  if (capabilities.cssAnimation) detected.push('css_animation');
  if (capabilities.externalAsset) detected.push('external_assets');
  if (capabilities.lorebookRegex) detected.push('lorebook_regex_keys');

  return detected;
}

export function analyzeRuntimeManifest(card: TavernCardV2): RuntimeManifest {
  const extensions =
    card.data.extensions && typeof card.data.extensions === 'object'
      ? (card.data.extensions as Record<string, unknown>)
      : {};
  const regexScripts = Array.isArray(extensions.regex_scripts)
    ? (extensions.regex_scripts as Array<Record<string, unknown>>)
    : [];
  const cardStrings = collectCardStrings(card);
  const mergedCardText = cardStrings.join('\n');
  const lorebookEntries = Array.isArray(card.data.character_book?.entries)
    ? card.data.character_book.entries
    : [];

  const hasRegex = regexScripts.length > 0;
  const regexFindStrings = regexScripts.map((script) => getString(script, 'findRegex'));
  const regexReplaceStrings = regexScripts.map((script) => getString(script, 'replaceString'));
  const hasHtmlDocument = regexScripts.some((script) =>
    /<(?:!doctype\s+html|html|body|head)\b/i.test(getString(script, 'replaceString')),
  );
  const hasScript =
    /<script[\s>]/i.test(mergedCardText) ||
    regexReplaceStrings.some((value) => /<script[\s>]/i.test(value));
  const hasVariableInsert = /<variableinsert>/i.test(mergedCardText);
  const hasEraData = /<era_data>/i.test(mergedCardText);
  const hasPlaceholder =
    /<StatusPlaceHolderImpl\s*\/?>/i.test(mergedCardText) ||
    regexFindStrings.some((value) => /<StatusPlaceHolderImpl/i.test(value));
  const hasStyledHtml = regexScripts.some((script) =>
    /style\s*=\s*["']/i.test(getString(script, 'replaceString')),
  );
  const hasCssAnimation = regexScripts.some((script) =>
    /@keyframes\b/i.test(getString(script, 'replaceString')),
  );
  const hasExternalAsset =
    /(?:src|href)\s*=\s*["']https?:\/\//i.test(mergedCardText) ||
    regexReplaceStrings.some((value) => /(?:src|href)\s*=\s*["']https?:\/\//i.test(value));
  const hasLorebookRegex = lorebookEntries.some(entryHasRegex);

  const hasEraPatterns =
    hasVariableInsert ||
    hasEraData ||
    hasPlaceholder ||
    regexScripts.some((script, index) =>
      /<(?:variable(?:insert|edit|delete|think)|era_data|StatusPlaceHolderImpl)/i.test(
        `${regexFindStrings[index]} ${regexReplaceStrings[index]}`,
      ),
    );

  const hasFatePatterns =
    /<(?:opening|battle|combat_driver|npc_driver|story_driver|story_engine|world_report|status|affinity)\b/i.test(
      mergedCardText,
    ) ||
    regexScripts.some((script, index) =>
      /<(?:opening|battle|combat_driver|npc_driver|story_driver|story_engine|world_report|status|affinity)\b/i.test(
        `${regexFindStrings[index]} ${regexReplaceStrings[index]}`,
      ),
    );

  const hasXmlTags =
    /<(?!\/)(?!html\b|head\b|body\b|div\b|span\b|p\b|br\b|hr\b|font\b|strong\b|em\b|section\b|main\b|article\b|header\b|footer\b|details\b|summary\b|button\b)[a-z][\w:-]*(?:\s[^>]*)?>/i.test(
      mergedCardText,
    );

  const capabilities: RuntimeCapabilities = {
    regex: hasRegex,
    htmlDocument: hasHtmlDocument,
    script: hasScript,
    xmlTags: hasXmlTags,
    variableInsert: hasVariableInsert,
    eraData: hasEraData,
    placeholder: hasPlaceholder,
    styledHtml: hasStyledHtml,
    cssAnimation: hasCssAnimation,
    externalAsset: hasExternalAsset,
    lorebookRegex: hasLorebookRegex,
  };

  const promptCompat =
    hasEraPatterns || hasLorebookRegex || /<%[=_-]?[\s\S]*?%>/i.test(mergedCardText);
  const renderCompat =
    hasEraPatterns ||
    hasFatePatterns ||
    hasHtmlDocument ||
    hasScript ||
    hasCssAnimation ||
    hasExternalAsset;
  const runtimeMode: RuntimeMode = promptCompat || renderCompat ? 'compat-sandbox' : 'native';

  let adapter: RuntimeAdapter | undefined;
  if (runtimeMode === 'compat-sandbox') {
    if (hasEraPatterns) {
      adapter = 'era';
    } else if (hasFatePatterns || hasLorebookRegex) {
      adapter = 'fate';
    } else {
      adapter = 'st-generic';
    }
  }

  return {
    runtimeMode,
    adapter,
    promptCompat,
    renderCompat,
    capabilities,
    detectedFeatures: collectDetectedFeatures(regexScripts, capabilities),
  };
}
