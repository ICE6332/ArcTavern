import { Injectable } from '@nestjs/common';
import type { CharacterRow } from '../character/character.service';
import type { MessageRow } from './chat.service';
import type { ActivatedEntry } from '../world-info/world-info-scanner.service';
import type { RuntimeManifest } from '../character/runtime-manifest';
import { SettingsService } from '../settings/settings.service';

type CompatAdapterId = NonNullable<RuntimeManifest['adapter']>;
type JsonRecord = Record<string, unknown>;

export interface CompatPromptContext {
  manifest: RuntimeManifest | null;
  adapter: CompatAdapterId | null;
  namespaces: {
    global: JsonRecord;
    chat: JsonRecord;
    character: JsonRecord;
    session: JsonRecord;
  };
  sessionState: JsonRecord;
  eraData: unknown;
  messageCompat: JsonRecord;
}

const VARIABLE_BLOCK_RE =
  /<(variableinsert|variableedit|variabledelete|era_data)>\s*([\s\S]*?)\s*<\/\1>/gi;
const ST_COMPAT_VARS_KEY = 'stCompatVars';
const AsyncFunction = Object.getPrototypeOf(async function () {
  return undefined;
}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: JsonRecord, source: JsonRecord): JsonRecord {
  const output: JsonRecord = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = deepMerge(output[key] as JsonRecord, value);
      continue;
    }
    output[key] = value;
  }

  return output;
}

function getByPath(root: JsonRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, root);
}

function setByPath(root: JsonRecord, path: string, value: unknown): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return;

  let current: JsonRecord = root;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const next = current[key];
    if (!isRecord(next)) {
      current[key] = {};
    }
    current = current[key] as JsonRecord;
  }

  current[keys[keys.length - 1]] = value;
}

function deleteByPath(root: JsonRecord, path: string): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return;

  let current: JsonRecord = root;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const next = current[keys[index]];
    if (!isRecord(next)) return;
    current = next;
  }

  delete current[keys[keys.length - 1]];
}

function parseStructuredValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function extractMessageCompat(messages: MessageRow[]): JsonRecord {
  const merged: JsonRecord = {};

  for (const message of messages) {
    if (!message.extra) continue;

    try {
      const parsed = JSON.parse(message.extra) as JsonRecord;
      const rawRows = parsed[ST_COMPAT_VARS_KEY];
      if (!Array.isArray(rawRows)) continue;

      const currentRow = rawRows[message.swipe_id];
      if (isRecord(currentRow)) {
        Object.assign(merged, currentRow);
      }
    } catch {
      // ignore malformed compat state in legacy messages
    }
  }

  return merged;
}

function extractManifest(character: CharacterRow): RuntimeManifest | null {
  try {
    const extensions = JSON.parse(character.extensions || '{}') as JsonRecord;
    return isRecord(extensions.runtimeManifest)
      ? (extensions.runtimeManifest as RuntimeManifest)
      : null;
  } catch {
    return null;
  }
}

@Injectable()
export class CompatPromptRuntimeService {
  constructor(private readonly settingsService: SettingsService) {}

  async prepare(
    character: CharacterRow,
    chatId: number,
    messages: MessageRow[],
  ): Promise<CompatPromptContext> {
    const manifest = extractManifest(character);
    const adapter = manifest?.promptCompat ? (manifest.adapter ?? null) : null;

    const [globalNamespace, chatNamespace, characterNamespace, storedSession] = await Promise.all([
      this.readNamespace('compat:global'),
      this.readNamespace(`compat:chat:${chatId}`),
      this.readNamespace(`compat:character:${character.id}`),
      this.readNamespace(`compat:session:${chatId}:${character.id}`),
    ]);

    let sessionState = isRecord(storedSession.stat_data)
      ? { ...(storedSession.stat_data as JsonRecord) }
      : {};
    let eraData = storedSession.eraData;

    for (const message of messages) {
      const blocks = [...message.content.matchAll(VARIABLE_BLOCK_RE)];
      for (const block of blocks) {
        const type = block[1]?.toLowerCase();
        const parsed = parseStructuredValue(block[2] ?? '');

        if (type === 'variableinsert' || type === 'variableedit') {
          if (isRecord(parsed)) {
            sessionState = deepMerge(sessionState, parsed);
          }
          continue;
        }

        if (type === 'variabledelete') {
          const targets = Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string')
            : typeof parsed === 'string'
              ? [parsed]
              : [];
          for (const target of targets) {
            deleteByPath(sessionState, target);
          }
          continue;
        }

        if (type === 'era_data') {
          eraData = parsed;
        }
      }
    }

    const messageCompat = extractMessageCompat(messages);
    const nextSession = {
      ...storedSession,
      stat_data: sessionState,
      eraData,
      messageCompat,
    };
    await this.settingsService.set(`compat:session:${chatId}:${character.id}`, nextSession);

    return {
      manifest,
      adapter,
      namespaces: {
        global: globalNamespace,
        chat: chatNamespace,
        character: characterNamespace,
        session: nextSession,
      },
      sessionState,
      eraData,
      messageCompat,
    };
  }

  async renderCharacter(
    character: CharacterRow,
    context: CompatPromptContext,
  ): Promise<CharacterRow> {
    if (!context.manifest?.promptCompat || !context.adapter) {
      return character;
    }

    return {
      ...character,
      description: await this.renderContent(character.description, context),
      personality: await this.renderContent(character.personality, context),
      scenario: await this.renderContent(character.scenario, context),
      system_prompt: await this.renderContent(character.system_prompt, context),
      mes_example: await this.renderContent(character.mes_example, context),
      post_history_instructions: await this.renderContent(
        character.post_history_instructions,
        context,
      ),
    };
  }

  async renderEntries(
    entries: ActivatedEntry[],
    context: CompatPromptContext,
  ): Promise<ActivatedEntry[]> {
    if (!context.manifest?.promptCompat || !context.adapter) return entries;

    return Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        content: await this.renderContent(entry.content, context),
      })),
    );
  }

  async renderContent(content: string, context: CompatPromptContext): Promise<string> {
    if (!content || !context.manifest?.promptCompat || !context.adapter) {
      return content;
    }

    let output = content;

    if (context.adapter === 'era') {
      output = output.replace(
        /\{\{ERA:\$ALLDATA\}\}/g,
        JSON.stringify(context.sessionState, null, 2),
      );
    }

    if (context.adapter === 'era' && /<%[\s\S]*?%>/.test(output)) {
      return this.renderEraTemplate(output, context);
    }

    return output;
  }

  private async readNamespace(key: string): Promise<JsonRecord> {
    const value = await this.settingsService.get(key);
    return isRecord(value) ? value : {};
  }

  private async renderEraTemplate(content: string, context: CompatPromptContext): Promise<string> {
    const templateRoot: JsonRecord = {
      stat_data: context.sessionState,
      ...context.sessionState,
      __eraData: context.eraData,
      __messageCompat: context.messageCompat,
      globalVars: context.namespaces.global,
      chatVars: context.namespaces.chat,
      characterVars: context.namespaces.character,
    };

    const body: string[] = [
      'let __out = "";',
      'const print = (...args) => { __out += args.join(""); };',
    ];
    const matcher = /<%([=_-]?)([\s\S]*?)%>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(content)) !== null) {
      const [raw, marker, code] = match;
      const text = content.slice(lastIndex, match.index);
      if (text) {
        body.push(`__out += ${JSON.stringify(text)};`);
      }

      if (marker === '=' || marker === '-') {
        body.push(`__out += __stringify(await (${code.trim()}));`);
      } else {
        body.push(code.trim());
      }

      lastIndex = match.index + raw.length;
    }

    const tail = content.slice(lastIndex);
    if (tail) {
      body.push(`__out += ${JSON.stringify(tail)};`);
    }
    body.push('return __out;');

    try {
      const fn = new AsyncFunction(
        '__helpers',
        `
          const __stringify = (value) => {
            if (value == null) return "";
            if (typeof value === "string") return value;
            return JSON.stringify(value);
          };
          const {
            getvar,
            getVar,
            setvar,
            setVar,
            addvar,
            getMessageVar,
            setMessageVar
          } = __helpers;
          with (__helpers) {
            ${body.join('\n')}
          }
        `,
      );

      const result = await fn({
        ...templateRoot,
        getvar: (path: string, options?: { defaults?: unknown }) =>
          getByPath(templateRoot, path) ?? options?.defaults,
        getVar: (path: string, options?: { defaults?: unknown }) =>
          getByPath(templateRoot, path) ?? options?.defaults,
        setvar: (path: string, value: unknown) => setByPath(templateRoot, path, value),
        setVar: (path: string, value: unknown) => setByPath(templateRoot, path, value),
        addvar: (path: string, delta: number) => {
          const current = Number(getByPath(templateRoot, path) ?? 0);
          setByPath(templateRoot, path, current + delta);
        },
        getMessageVar: (path: string, options?: { defaults?: unknown }) =>
          getByPath(context.messageCompat, path) ?? options?.defaults,
        setMessageVar: (path: string, value: unknown) =>
          setByPath(context.messageCompat, path, value),
      });

      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch {
      return content;
    }
  }
}
