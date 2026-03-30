#!/usr/bin/env node
/**
 * OpenUI 结构化 JSON 端到端压测（需本地 Arctravern 后端已启动）。
 *
 * 流程：
 * 1. 写入 api_key_custom（gcli 密钥）
 * 2. GET /api/ai-provider/models/discover 拉取模型，匹配 3.1-pro 与 2.5-pro
 * 3. 复用已有角色卡（不创建）：CHARACTER_ID 优先，否则按名称子串匹配（默认「青梅」）
 * 4. 复用或创建该角色的会话
 * 5. 阶段 A：5 轮（可配置），间隔 STRESS_INTERVAL_SEC（默认 30s），custom + openai-compatible + structuredOutput
 * 6. 阶段 B：10 轮，custom + google（Gemini 原生）+ structuredOutput
 *
 * 环境变量（勿把密钥提交到仓库）：
 *   GCLI_API_KEY   — 必填，Bearer Token
 *   GCLI_BASE_URL  — 默认 https://gcli.ggchan.dev
 *   API_BASE       — 默认 http://localhost:5001/api
 *   CHARACTER_ID   — 可选，直接指定角色 id（与库里「青梅竹马」卡一致时最稳）
 *   CHARACTER_NAME_SUBSTR — 未指定 id 时，匹配名称包含该子串的第一个角色，默认「青梅」
 *   CHARACTER_CARD_PATH — 可选；若未匹配到角色，则从该路径 import（png/json/yaml）一次
 *   STRESS_QUICK=1 — 只跑阶段 A 1 轮 + 阶段 B 1 轮，间隔 0（冒烟）
 *   STRESS_INTERVAL_SEC — 轮次间隔秒数，默认 30；QUICK 模式下为 0
 *   STRESS_ROUNDS_A / STRESS_ROUNDS_B — 覆盖轮数（默认 5 / 10）
 *   阶段 A（3.1 Pro，openai-compatible）传输较慢，额外参数：
 *   STRESS_31_TIMEOUT_MS — 单次生成最长等待（毫秒），默认 600000（10 分钟）
 *   STRESS_31_RETRIES — 若 structured 分块为 0 且无 HTTP 错误，自动重试次数，默认 3
 *   STRESS_31_RETRY_MS — 重试前等待，默认 45000（45 秒）
 *   STRESS_31_TEMPERATURE — 采样温度，默认 0.42（略降以提高 JSON 遵从度）
 *   STRESS_31_MAX_TOKENS — 默认 8192
 *   STRESS_B_TIMEOUT_MS — 阶段 B 单次超时，默认 240000（4 分钟）
 *
 * 用法：
 *   set GCLI_API_KEY=... && set CHARACTER_ID=18 && node scripts/openui-structured-e2e-stress.mjs
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const GCLI_KEY = process.env.GCLI_API_KEY?.trim();
const GCLI_BASE = (process.env.GCLI_BASE_URL || "https://gcli.ggchan.dev").replace(/\/+$/, "");
const API_BASE = (process.env.API_BASE || "http://localhost:5001/api").replace(/\/+$/, "");

const STRESS_QUICK = process.env.STRESS_QUICK === "1" || process.env.STRESS_QUICK === "true";
const STRESS_ROUNDS_A = STRESS_QUICK
  ? 1
  : Math.min(99, Math.max(1, parseInt(process.env.STRESS_ROUNDS_A ?? "5", 10) || 5));
const STRESS_ROUNDS_B = STRESS_QUICK
  ? 1
  : Math.min(99, Math.max(1, parseInt(process.env.STRESS_ROUNDS_B ?? "10", 10) || 10));
const STRESS_INTERVAL_MS = STRESS_QUICK
  ? 0
  : Math.max(0, (parseInt(process.env.STRESS_INTERVAL_SEC ?? "30", 10) || 30) * 1000);

const STRESS_31_TIMEOUT_MS = Math.max(
  60000,
  parseInt(process.env.STRESS_31_TIMEOUT_MS ?? "600000", 10) || 600000,
);
const STRESS_B_TIMEOUT_MS = Math.max(
  60000,
  parseInt(process.env.STRESS_B_TIMEOUT_MS ?? "240000", 10) || 240000,
);
const STRESS_31_RETRIES = Math.max(1, parseInt(process.env.STRESS_31_RETRIES ?? "3", 10) || 3);
const STRESS_31_RETRY_MS = Math.max(
  0,
  parseInt(process.env.STRESS_31_RETRY_MS ?? "45000", 10) || 45000,
);
const STRESS_31_TEMPERATURE = (() => {
  const t = parseFloat(process.env.STRESS_31_TEMPERATURE ?? "0.42");
  return Number.isFinite(t) ? t : 0.42;
})();
const STRESS_B_TEMPERATURE = (() => {
  const t = parseFloat(process.env.STRESS_B_TEMPERATURE ?? "0.85");
  return Number.isFinite(t) ? t : 0.85;
})();
const STRESS_31_MAX_TOKENS = Math.max(
  1024,
  parseInt(process.env.STRESS_31_MAX_TOKENS ?? "8192", 10) || 8192,
);
const STRESS_B_MAX_TOKENS = Math.max(
  1024,
  parseInt(process.env.STRESS_B_MAX_TOKENS ?? "8192", 10) || 8192,
);

/** 追加在用户消息后，强化 JSON-only（仅阶段 A） */
const PHASE_A_JSON_SUFFIX = `
【硬性要求·必须遵守】整段回复只能是且仅是一个 JSON 对象，形如 {"blocks":[...]}。不要用 markdown 代码块包裹全文，不要在 JSON 前后写任何说明。第一个非空白字符必须是 { 。`;

/** 新注册的 block role（用于统计是否产出） */
const NEW_BLOCK_ROLES = new Set([
  "tabs",
  "accordion",
  "stat",
  "quote",
  "gallery",
  "timeline",
  "inventory",
  "spoiler",
]);

const PROMPTS_PHASE_A = [
  `【结构化输出测试·回合1】你是青梅竹马。今天放学后一起逛祭典。请仅用 JSON blocks 回复（含 narration），并至少包含：
- 一个 tabs：两个 tab（「祭典视角」「内心独白」），内容用 markdown。
- 一个 stat：title 为「状态」，stats 含「体力」「心情」两项，带 max 的进度条。
- 一个 quote：引用一句祭典广播语，variant 用 muted。`,

  `【回合2】继续青梅竹马剧情。请输出 blocks，至少包含：accordion（两人童年回忆 2 条）、inventory（背包里 3 样物品含 rarity）、spoiler（藏一句祭典真相）。`,

  `【回合3】请包含：timeline（至少 3 个 events：时间线从相遇到今晚）、gallery（items 里用 https://picsum.photos/seed/a/400/400 这类占位图 2 张 + caption）。`,

  `【回合4】混用 narration、card、alert，并额外包含至少一个 tabs 与一个 stat（战斗小游戏数值）。`,

  `【回合5】请尽量在一条回复里覆盖这些 role：tabs, accordion, stat, quote, gallery, timeline, inventory, spoiler（可与 narration 混用；gallery 可用占位图 URL）。`,
];

const PROMPTS_PHASE_B = [
  `【Gemini·回合1】青梅竹马主题。请输出结构化 blocks，含 tabs + stat + quote。`,
  `【回合2】accordion + timeline + inventory。`,
  `【回合3】gallery（2 图）+ spoiler + narration。`,
  `【回合4】stat + quote + alert + choices（给三个选项字符串）。`,
  `【回合5】timeline + card + separator + progress。`,
  `【回合6】tabs + accordion + 多段 narration。`,
  `【回合7】inventory + gallery + spoiler。`,
  `【回合8】综合运用 stat、quote、timeline。`,
  `【回合9】全 block 类型尽量多样（含新注册的 8 类中的至少 5 类）。`,
  `【回合10】收尾剧情，结构化 JSON，含 tabs、accordion、stat、quote 各一。`,
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setSecret() {
  if (!GCLI_KEY) {
    console.error("缺少环境变量 GCLI_API_KEY");
    process.exit(1);
  }
  const res = await fetch(`${API_BASE}/secrets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "api_key_custom", value: GCLI_KEY }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST /secrets failed: ${res.status} ${t}`);
  }
  console.log("[ok] 已写入 secrets api_key_custom");
}

async function healthCheckCustom() {
  const res = await fetch(`${API_BASE}/ai-provider/health-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "custom",
      apiKey: GCLI_KEY,
      baseUrl: GCLI_BASE,
    }),
  });
  return res.json();
}

async function discoverModels() {
  const url = `${API_BASE}/ai-provider/models/discover?provider=${encodeURIComponent("custom")}&baseUrl=${encodeURIComponent(GCLI_BASE)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`discoverModels failed: ${res.status} ${t}`);
  }
  return res.json();
}

function pickModelId(models, predicates) {
  for (const pred of predicates) {
    const m = models.find((x) => pred(x.id));
    if (m) return m.id;
  }
  return null;
}

async function importCharacterCard(filePath) {
  const buf = readFileSync(filePath);
  const filename = basename(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf]), filename);
  const res = await fetch(`${API_BASE}/characters/import`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST /characters/import failed: ${res.status} ${t}`);
  }
  return res.json();
}

/**
 * 只复用数据库已有角色，不在压测中创建占位卡。
 */
async function resolveCharacter() {
  const idEnv = process.env.CHARACTER_ID?.trim();
  if (idEnv) {
    const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(idEnv)}`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET /characters/${idEnv} failed: ${res.status} ${t}`);
    }
    const c = await res.json();
    console.log(`[ok] 使用 CHARACTER_ID=${c.id} name=${c.name}`);
    return c;
  }

  const substr = process.env.CHARACTER_NAME_SUBSTR ?? "青梅";
  const res = await fetch(`${API_BASE}/characters`);
  if (!res.ok) throw new Error(`GET /characters ${res.status}`);
  const all = await res.json();
  const found = all.find((c) => String(c.name).includes(substr));
  if (found) {
    console.log(`[ok] 复用角色（名称含「${substr}」）id=${found.id} name=${found.name}`);
    return found;
  }

  const cardPath = process.env.CHARACTER_CARD_PATH?.trim();
  if (cardPath) {
    console.log(`[ok] 未找到匹配角色，从 CHARACTER_CARD_PATH 导入: ${cardPath}`);
    const created = await importCharacterCard(cardPath);
    console.log(`[ok] 导入成功 id=${created.id} name=${created.name}`);
    return created;
  }

  const names = all.map((c) => `${c.id}: ${c.name}`).join("\n");
  throw new Error(
    `未找到名称包含「${substr}」的角色。请先在客户端导入「青梅竹马」卡，或设置 CHARACTER_ID / CHARACTER_CARD_PATH。\n当前角色列表：\n${names || "(空)"}`,
  );
}

async function ensureChat(characterId) {
  const res = await fetch(`${API_BASE}/chats?characterId=${characterId}`);
  if (!res.ok) throw new Error(`GET /chats ${res.status}`);
  const chats = await res.json();
  if (chats.length) {
    console.log(`[ok] 复用会话 id=${chats[0].id}`);
    return chats[0];
  }
  const cr = await fetch(`${API_BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, name: "OpenUI压测" }),
  });
  if (!cr.ok) {
    const t = await cr.text();
    throw new Error(`POST /chats failed: ${cr.status} ${t}`);
  }
  const chat = await cr.json();
  console.log(`[ok] 已创建会话 id=${chat.id}`);
  return chat;
}

/**
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @returns {Promise<{ rolesHit: Set<string>, newRolesHit: Set<string>, error?: string, chunks: number }>}
 */
async function runStructuredGeneration(chatId, model, customApiFormat, userMessage, options = {}) {
  const timeoutMs = options.timeoutMs ?? STRESS_B_TIMEOUT_MS;
  const temperature = Number.isFinite(options.temperature) ? options.temperature : STRESS_B_TEMPERATURE;
  const maxTokens = options.maxTokens ?? STRESS_B_MAX_TOKENS;

  const body = {
    provider: "custom",
    model,
    reverseProxy: GCLI_BASE,
    customApiFormat,
    structuredOutput: true,
    type: "normal",
    message: userMessage,
    temperature,
    maxTokens,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}/chat/${chatId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rolesHit: new Set(), newRolesHit: new Set(), error: msg, chunks: 0 };
  }

  if (!res.ok) {
    const t = await res.text();
    return { rolesHit: new Set(), newRolesHit: new Set(), error: `HTTP ${res.status}: ${t}`, chunks: 0 };
  }

  const rolesHit = new Set();
  const newRolesHit = new Set();
  let chunks = 0;
  let buf = "";
  const reader = res.body?.getReader();
  if (!reader) {
    return { rolesHit, newRolesHit, error: "no response body", chunks: 0 };
  }
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        if (j.error) {
          return { rolesHit, newRolesHit, error: String(j.error), chunks };
        }
        if (j.structured?.blocks && Array.isArray(j.structured.blocks)) {
          chunks += 1;
          for (const b of j.structured.blocks) {
            if (b?.role) {
              rolesHit.add(b.role);
              if (NEW_BLOCK_ROLES.has(b.role)) newRolesHit.add(b.role);
            }
          }
        }
      } catch {
        // ignore partial JSON lines
      }
    }
  }

  return { rolesHit, newRolesHit, chunks };
}

/**
 * 3.1 Pro：更长超时 + 低温度 + 用户消息 JSON 后缀；若仍无 structured 分块则间隔重试。
 */
async function runStructuredGenerationPhase31(chatId, model, promptBase) {
  const userMessage = `${promptBase.trim()}${PHASE_A_JSON_SUFFIX}`;
  let last = /** @type {{ rolesHit: Set<string>, newRolesHit: Set<string>, error?: string, chunks: number }} */ ({
    rolesHit: new Set(),
    newRolesHit: new Set(),
    chunks: 0,
  });

  for (let attempt = 1; attempt <= STRESS_31_RETRIES; attempt++) {
    const tag = attempt > 1 ? ` 重试${attempt}/${STRESS_31_RETRIES}` : "";
    console.log(
      `[3.1] 请求超时阈值 ${STRESS_31_TIMEOUT_MS}ms · temperature=${STRESS_31_TEMPERATURE}${tag}`,
    );

    last = await runStructuredGeneration(chatId, model, "openai-compatible", userMessage, {
      timeoutMs: STRESS_31_TIMEOUT_MS,
      temperature: STRESS_31_TEMPERATURE,
      maxTokens: STRESS_31_MAX_TOKENS,
    });

    if (last.error) {
      console.log(`[3.1] 结束（有错误）: ${last.error}`);
      return last;
    }
    if (last.chunks > 0) {
      return last;
    }
    if (attempt < STRESS_31_RETRIES) {
      console.log(
        `[3.1] 未收到 structured 分块（chunks=0），等待 ${STRESS_31_RETRY_MS}ms 后重试…`,
      );
      await sleep(STRESS_31_RETRY_MS);
    }
  }
  return last;
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  console.log(`GCLI_BASE=${GCLI_BASE}`);
  await setSecret();

  let models = await discoverModels();
  if (!Array.isArray(models) || models.length === 0) {
    const hc = await healthCheckCustom();
    console.error("未发现任何模型。health-check 结果:", JSON.stringify(hc, null, 2));
    console.error("请确认：后端已启动、GCLI_BASE_URL 可访问、GCLI_API_KEY 有效。");
    process.exit(1);
  }
  console.log(`[models] 共 ${models.length} 个，示例: ${models.slice(0, 8).map((m) => m.id).join(", ")}`);

  const id31 = pickModelId(models, [
    (id) => /3\.1/i.test(id) && /pro/i.test(id),
    (id) => /gemini-3.*1.*pro/i.test(id),
    (id) => /3\.1-pro/i.test(id),
    (id) => /3\.1/i.test(id),
  ]);

  const id25 = pickModelId(models, [
    (id) => /2\.5/i.test(id) && /pro/i.test(id),
    (id) => /gemini-2\.5.*pro/i.test(id),
    (id) => /2\.5-pro/i.test(id),
  ]);

  if (!id31) {
    console.error("未匹配到 3.1-pro 系模型，请从下列 id 中手动指定环境变量 MODEL_31_PRO");
    console.error(models.map((m) => m.id).join("\n"));
    process.exit(1);
  }
  if (!id25) {
    console.error("未匹配到 2.5-pro 系模型，请从下列 id 中手动指定环境变量 MODEL_25_PRO");
    console.error(models.map((m) => m.id).join("\n"));
    process.exit(1);
  }

  const model31 = process.env.MODEL_31_PRO?.trim() || id31;
  const model25 = process.env.MODEL_25_PRO?.trim() || id25;
  console.log(`[phase A] 使用模型: ${model31} (openai-compatible)`);
  console.log(`[phase B] 使用模型: ${model25} (google / Gemini 原生)`);

  console.log(
    `压测参数: QUICK=${STRESS_QUICK} ROUNDS_A=${STRESS_ROUNDS_A} ROUNDS_B=${STRESS_ROUNDS_B} INTERVAL_MS=${STRESS_INTERVAL_MS}`,
  );
  console.log(
    `[3.1] TIMEOUT_MS=${STRESS_31_TIMEOUT_MS} RETRIES=${STRESS_31_RETRIES} RETRY_MS=${STRESS_31_RETRY_MS} temp=${STRESS_31_TEMPERATURE}`,
  );
  console.log(`[2.5] TIMEOUT_MS=${STRESS_B_TIMEOUT_MS} temp=${STRESS_B_TEMPERATURE}`);

  const char = await resolveCharacter();
  const chat = await ensureChat(char.id);

  const summary = [];

  for (let i = 0; i < STRESS_ROUNDS_A; i++) {
    const idx = STRESS_QUICK ? 0 : i;
    console.log(`\n========== 阶段 A ${i + 1}/${STRESS_ROUNDS_A} ==========`);
    const prompt = PROMPTS_PHASE_A[idx % PROMPTS_PHASE_A.length];
    const r = await runStructuredGenerationPhase31(chat.id, model31, prompt);
    console.log(`chunks(structured 更新次数): ${r.chunks}`);
    console.log(`roles: ${[...r.rolesHit].join(", ") || "(无)"}`);
    console.log(`新组件命中: ${[...r.newRolesHit].join(", ") || "(无)"}`);
    if (r.error) console.log(`error: ${r.error}`);
    summary.push({ phase: "A", round: i + 1, ...r, roles: [...r.rolesHit], newRoles: [...r.newRolesHit] });
    if (i < STRESS_ROUNDS_A - 1 && STRESS_INTERVAL_MS > 0) {
      console.log(`等待 ${STRESS_INTERVAL_MS / 1000}s...`);
      await sleep(STRESS_INTERVAL_MS);
    }
  }

  console.log(`\n阶段 A 完成，${STRESS_INTERVAL_MS / 1000 || 0}s 后开始阶段 B（2.5 pro / Gemini 原生）...`);
  await sleep(STRESS_INTERVAL_MS);

  for (let i = 0; i < STRESS_ROUNDS_B; i++) {
    const idx = STRESS_QUICK ? 0 : i;
    console.log(`\n========== 阶段 B ${i + 1}/${STRESS_ROUNDS_B} ==========`);
    const prompt = PROMPTS_PHASE_B[idx % PROMPTS_PHASE_B.length];
    const r = await runStructuredGeneration(chat.id, model25, "google", prompt, {
      timeoutMs: STRESS_B_TIMEOUT_MS,
      temperature: STRESS_B_TEMPERATURE,
      maxTokens: STRESS_B_MAX_TOKENS,
    });
    console.log(`chunks: ${r.chunks}`);
    console.log(`roles: ${[...r.rolesHit].join(", ") || "(无)"}`);
    console.log(`新组件命中: ${[...r.newRolesHit].join(", ") || "(无)"}`);
    if (r.error) console.log(`error: ${r.error}`);
    summary.push({ phase: "B", round: i + 1, ...r, roles: [...r.rolesHit], newRoles: [...r.newRolesHit] });
    if (i < STRESS_ROUNDS_B - 1 && STRESS_INTERVAL_MS > 0) {
      console.log(`等待 ${STRESS_INTERVAL_MS / 1000}s...`);
      await sleep(STRESS_INTERVAL_MS);
    }
  }

  console.log("\n========== 汇总 ==========");
  const hitNew = summary.filter((s) => s.newRoles?.length > 0).length;
  console.log(`有产出新 block 的轮次: ${hitNew}/${summary.length}`);
  console.log("完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
