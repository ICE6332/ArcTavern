#!/usr/bin/env node
/**
 * OpenUI Stress Test — Gemini 3 Flash Preview
 * Tests both OpenAI-compatible and Google Gemini native API formats
 * 20 messages per protocol with realistic intervals to avoid 429
 */

const BASE = "http://localhost:5001/api";
const REVERSE_PROXY = "https://huan.baby/v1";
const MODEL_OPENAI = "gcli-gemini-3-flash-preview-nothinking";
const MODEL_GOOGLE = "gcli-gemini-3-flash-preview-nothinking";
const TITLE_MODEL = "gcli-gemini-3-flash-preview-nothinking";

// --- Helpers ---
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

async function readSSE(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let structured = null;
  let content = "";
  let error = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) content += parsed.content;
        if (parsed.structured) structured = parsed.structured;
        if (parsed.error) error = parsed.error;
      } catch {}
    }
  }

  return { content, structured, error };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInterval() {
  // 3-8 seconds to simulate real user and avoid 429
  return 3000 + Math.random() * 5000;
}

// --- Test data: various user messages to exercise different OpenUI block types ---
const TEST_MESSAGES = [
  "你好，初次见面，请介绍一下你自己。",
  "*走进了实验室* 这里的设备都是做什么用的？",
  "给我看看你最近的实验数据。",
  "有什么需要我注意的危险区域吗？",
  "*翻看桌上的文件* 这份报告说了什么？",
  "你能帮我分析一下这个代码的bug吗？",
  "你今天的心情怎么样？",
  "*好奇地走向窗户* 外面的景色真美...",
  "给我讲讲这个世界的历史吧。",
  "你有什么特别的能力或技能吗？",
  "我们来做个实验！需要什么材料？",
  "*递给你一杯咖啡* 辛苦了。",
  "你觉得AI的未来会怎么样？",
  "给我推荐几个有趣的研究方向。",
  "*注意到墙上的照片* 这些人是谁？",
  "帮我写一段Python代码，计算斐波那契数列。",
  "你最喜欢的研究项目是什么？",
  "*打开电脑* 让我看看最新的系统状态。",
  "如果你能选择任何超能力，你会选什么？",
  "今天的工作就到这里吧，明天见！",
];

// --- Setup: use existing character(id=15) and world info book(id=2) if they exist ---
async function setup() {
  console.log("\n=== SETUP ===\n");

  // Check if Nova-X already exists
  const chars = await api("/characters");
  const existing = chars.find((c) => c.name === "Nova-X");
  if (existing) {
    console.log(`  Reusing character: id=${existing.id} name=${existing.name}`);
    const books = await api("/world-info");
    const existingBook = books.find((b) => b.name.includes("Nova-X") || b.name.includes("量子"));
    if (existingBook) {
      console.log(`  Reusing world info book: id=${existingBook.id} name=${existingBook.name}`);
      return { characterId: existing.id, bookId: existingBook.id };
    }
  }

  // Create character
  const char = await api("/characters", {
    method: "POST",
    body: JSON.stringify({
      name: "Nova-X",
      description:
        '{{char}} 是一位未来世界的量子计算研究员。她拥有一头渐变紫蓝色长发，常穿全息投影实验服。性格温柔但对科学充满热情，擅长用生动的比喻解释复杂概念。她的实验室位于一座漂浮在云端的研究站中。',
      personality: '温柔, 好奇, 知识渊博, 偶尔幽默, 对新事物充满热情',
      scenario:
        '{{user}} 是一位新加入浮空研究站的研究助理。今天是第一天报到，{{char}} 被指派为导师。研究站正在进行一项关于量子纠缠通信的重大实验。',
      first_mes:
        '*Nova-X 从全息终端前转过身来，微微一笑* "你好！你就是新来的研究助理吧？我是 Nova-X，你可以叫我 Nova。" *她推了推鼻梁上的数据眼镜* "欢迎来到浮空研究站。"',
      system_prompt: "",
      post_history_instructions: "",
      creator: "stress-test",
      character_version: "1.0",
      tags: "test,openui,stress",
    }),
  });
  console.log(`  Character created: id=${char.id} name=${char.name}`);

  // Create world info book
  const book = await api("/world-info", {
    method: "POST",
    body: JSON.stringify({ name: "Nova-X 量子世界", description: "浮空研究站设定集" }),
  });
  console.log(`  World Info book created: id=${book.id}`);

  const entries = [
    { keys: ["浮空研究站", "研究站", "实验室"], content: "浮空研究站位于平流层30000英尺，由反重力引擎悬浮。配备量子计算集群和全息投影。127名研究员常驻。", comment: "浮空研究站", position: "before_char", priority: 100 },
    { keys: ["量子纠缠", "量子", "纠缠通信"], content: "量子纠缠通信是研究站核心项目，代号『织女桥』。已在地月间建立稳定超光速通信链路。", comment: "量子纠缠", position: "before_char", priority: 90 },
    { keys: ["全息", "投影", "终端"], content: "全息投影系统是研究站标准交互界面，支持3D建模和数据可视化。", comment: "全息投影", position: "after_char", priority: 80 },
    { keys: ["危险", "警告", "安全", "禁区"], content: "B区为高能实验禁区，安全等级红色。曾发生量子波动事故导致时空扭曲。", comment: "安全", position: "before_char", priority: 95 },
    { keys: ["历史", "创建", "建站"], content: "研究站建于2157年，创始人陈星辰教授。从12人发展为全球最先进量子基地。", comment: "历史", position: "after_char", priority: 70 },
  ];
  for (const entry of entries) {
    await api(`/world-info/${book.id}/entries`, { method: "POST", body: JSON.stringify(entry) });
  }
  console.log(`  ${entries.length} world info entries created`);

  return { characterId: char.id, bookId: book.id };
}

// --- Stress Test ---
async function stressTest(label, characterId, bookId, provider, model, extra = {}) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  STRESS TEST: ${label}`);
  console.log(`  Provider: ${provider} | Model: ${model}`);
  if (extra.customApiFormat) console.log(`  API Format: ${extra.customApiFormat}`);
  console.log(`  Reverse Proxy: ${extra.reverseProxy || "(none)"}`);
  console.log(`  Messages: ${TEST_MESSAGES.length} | Structured Output: ON`);
  console.log(`${"=".repeat(60)}\n`);

  const chat = await api("/chats", {
    method: "POST",
    body: JSON.stringify({ characterId, name: `[Stress] ${label}` }),
  });
  console.log(`  Chat created: id=${chat.id}\n`);

  const results = {
    total: TEST_MESSAGES.length,
    success: 0,
    structuredOk: 0,
    textOnly: 0,
    failed: 0,
    errors: [],
    blockTypeCounts: {},
    latencies: [],
    totalBlocks: 0,
  };

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const msg = TEST_MESSAGES[i];
    const shortMsg = msg.length > 25 ? msg.slice(0, 25) + "..." : msg;
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${TEST_MESSAGES.length}] ${shortMsg.padEnd(30)} `);

    const start = Date.now();
    try {
      const res = await readSSE(`/chat/${chat.id}/generate`, {
        type: "normal",
        provider,
        model,
        message: msg,
        temperature: 0.8,
        maxTokens: 1024,
        structuredOutput: true,
        worldInfoBookIds: [bookId],
        userName: "研究员",
        ...extra,
      });

      const elapsed = Date.now() - start;
      results.latencies.push(elapsed);

      if (res.error) {
        results.failed++;
        results.errors.push({ index: i + 1, error: res.error });
        console.log(`FAIL ${elapsed}ms — ${res.error}`);
      } else if (res.structured?.blocks) {
        results.success++;
        results.structuredOk++;
        const blocks = res.structured.blocks;
        results.totalBlocks += blocks.length;
        for (const block of blocks) {
          const role = block.role || "unknown";
          results.blockTypeCounts[role] = (results.blockTypeCounts[role] || 0) + 1;
        }
        const types = blocks.map((b) => b.role).join(",");
        console.log(`OK ${elapsed}ms — ${blocks.length} blocks [${types}]`);
      } else if (res.content) {
        results.success++;
        results.textOnly++;
        console.log(`TEXT ${elapsed}ms — ${res.content.length} chars`);
      } else {
        results.failed++;
        results.errors.push({ index: i + 1, error: "Empty response" });
        console.log(`EMPTY ${elapsed}ms`);
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      results.failed++;
      results.errors.push({ index: i + 1, error: err.message });
      console.log(`ERR ${elapsed}ms — ${err.message.slice(0, 80)}`);
    }

    // Realistic interval
    if (i < TEST_MESSAGES.length - 1) {
      const wait = randomInterval();
      await sleep(wait);
    }
  }

  // Title generation test
  console.log(`\n  --- Title Generation ---`);
  try {
    const titleResult = await api(`/chat/${chat.id}/generate-title`, {
      method: "POST",
      body: JSON.stringify({ provider, model: TITLE_MODEL, reverseProxy: REVERSE_PROXY, customApiFormat: "openai-compatible" }),
    });
    console.log(`  Title: "${titleResult.title}"`);
  } catch (err) {
    console.log(`  Title FAIL: ${err.message.slice(0, 80)}`);
  }

  // Summary
  const avg = results.latencies.length ? Math.round(results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length) : 0;
  const min = results.latencies.length ? Math.min(...results.latencies) : 0;
  const max = results.latencies.length ? Math.max(...results.latencies) : 0;
  const p95idx = Math.floor(results.latencies.length * 0.95);
  const sorted = [...results.latencies].sort((a, b) => a - b);
  const p95 = sorted[p95idx] || max;

  console.log(`\n  ┌─── ${label} SUMMARY ───`);
  console.log(`  │ Total: ${results.total}  Success: ${results.success}  Failed: ${results.failed}`);
  console.log(`  │ Structured: ${results.structuredOk}  Text-only: ${results.textOnly}`);
  console.log(`  │ Total blocks: ${results.totalBlocks}`);
  if (Object.keys(results.blockTypeCounts).length > 0) {
    console.log(`  │ Block types:`);
    for (const [type, count] of Object.entries(results.blockTypeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  │   ${type}: ${count}`);
    }
  }
  console.log(`  │ Latency: avg=${avg}ms  min=${min}ms  max=${max}ms  p95=${p95}ms`);
  if (results.errors.length > 0) {
    console.log(`  │ Errors (${results.errors.length}):`);
    for (const e of results.errors.slice(0, 5)) {
      console.log(`  │   #${e.index}: ${e.error.slice(0, 60)}`);
    }
    if (results.errors.length > 5) console.log(`  │   ... and ${results.errors.length - 5} more`);
  }
  console.log(`  └${"─".repeat(40)}\n`);

  return results;
}

// --- Main ---
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  OpenUI Stress Test — Gemini 3 Flash Preview        ║");
  console.log("║  A: OpenAI Compatible  B: Google Gemini Native      ║");
  console.log("║  20 messages x 2 protocols + title generation       ║");
  console.log("║  Reverse Proxy: huan.baby/v1                        ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  try { await api("/characters"); console.log("\n  Server: OK"); } catch { console.error("Server unreachable"); process.exit(1); }

  const { characterId, bookId } = await setup();

  // --- Protocol A: OpenAI Compatible ---
  const resultA = await stressTest(
    "OpenAI Compatible",
    characterId, bookId,
    "custom", MODEL_OPENAI,
    { customApiFormat: "openai-compatible", reverseProxy: REVERSE_PROXY }
  );

  console.log("  Cooling down 10s between protocols...\n");
  await sleep(10000);

  // --- Protocol B: Google Gemini Native ---
  const resultB = await stressTest(
    "Google Gemini Native",
    characterId, bookId,
    "custom", MODEL_GOOGLE,
    { customApiFormat: "google", reverseProxy: REVERSE_PROXY }
  );

  // Final comparison
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║                 COMPARISON                          ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  const fmtRow = (label, a, b) => console.log(`║  ${label.padEnd(20)} ${String(a).padStart(8)}  ${String(b).padStart(8)}  ║`);
  console.log(`║  ${"Metric".padEnd(20)} ${"OAI-Compat".padStart(8)}  ${"Google".padStart(8)}  ║`);
  console.log(`║  ${"─".repeat(20)} ${"─".repeat(8)}  ${"─".repeat(8)}  ║`);
  fmtRow("Success", resultA.success, resultB.success);
  fmtRow("Failed", resultA.failed, resultB.failed);
  fmtRow("Structured", resultA.structuredOk, resultB.structuredOk);
  fmtRow("Text-only", resultA.textOnly, resultB.textOnly);
  fmtRow("Total blocks", resultA.totalBlocks, resultB.totalBlocks);
  const avgA = resultA.latencies.length ? Math.round(resultA.latencies.reduce((a, b) => a + b, 0) / resultA.latencies.length) : 0;
  const avgB = resultB.latencies.length ? Math.round(resultB.latencies.reduce((a, b) => a + b, 0) / resultB.latencies.length) : 0;
  fmtRow("Avg latency (ms)", avgA, avgB);
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
