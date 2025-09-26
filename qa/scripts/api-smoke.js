#!/usr/bin/env node
import { argv, exit } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const args = new Map(
  argv.slice(2).map(arg => {
    const [key, value = 'true'] = arg.split('=');
    return [key.replace(/^--/, ''), value];
  })
);

const base = normalizeBase(
  args.get('base') || process.env.QA_API_BASE || 'http://localhost:3001/api'
);
const verbose = args.has('verbose') || process.env.QA_DEBUG === '1';
const timeoutMs = Number(args.get('timeout') || process.env.QA_TIMEOUT || 10_000);
const testUser = args.get('user') || `qa-smoke-${Date.now()}`;
const testDate = new Date().toISOString().split('T')[0];

const results = [];
let dbConnected = true;

function buildUrl(path = '') {
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

(async () => {
  logHeadline(`API smoke для ${base}`);
  await runStep('GET /health', fetchAndAssert(buildUrl('/health'), data => data?.status === 'OK'));
  await runStep('GET /test', async () => {
    const data = await fetchJson(buildUrl('/test'));
    assert(data?.timestamp, 'ожидается timestamp');
    dbConnected = data?.mongodb === 'connected';
  });

  await runStep(`GET задачи (пусто) для ${testUser}`, async () => {
    const data = await fetchJson(buildUrl(`/tasks/${testUser}`));
    assert(isPlainObject(data), 'ожидается объект задач');
    assert(Object.keys(data).length === 0, 'ожидается пустой результат');
  });

  const payload = {
    date: testDate,
    tasks: [
      {
        text: 'QA smoke task',
        category: 'work',
        priority: 'high',
        created: new Date().toISOString(),
        starred: true,
      },
    ],
  };

  await runStep(`POST задача для ${testDate}`, async () => {
    const res = await fetch(buildUrl(`/tasks/${testUser}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert(res.ok, `ожидается 2xx, получено ${res.status}`);
    const data = await res.json();
    assert(data?.success === true, 'ожидается success=true');
  });

  await delay(250);

  await runStep('GET задачи после сохранения', async () => {
    const data = await fetchJson(buildUrl(`/tasks/${testUser}`));
    assert(isPlainObject(data), 'ожидается объект задач');
    if (!dbConnected) {
      assert(!data[testDate], 'в dev режиме задачи не сохраняются в БД');
      return;
    }
    assert(Array.isArray(data[testDate]), 'должен существовать массив задач на дату');
    assert(data[testDate][0]?.text === payload.tasks[0].text, 'текст задачи должен совпадать');
  });

  await runStep('DELETE задачи', async () => {
    if (!dbConnected) {
      return;
    }
    const res = await fetch(buildUrl(`/tasks/${testUser}/${testDate}`), {
      method: 'DELETE',
    });
    assert(res.ok, `ожидается 2xx, получено ${res.status}`);
    const data = await res.json();
    assert(data?.success === true, 'ожидается success=true');
  });

  await runStep('GET задачи после очистки', async () => {
    const data = await fetchJson(buildUrl(`/tasks/${testUser}`));
    assert(!data[testDate], 'массив задач должен исчезнуть');
  });

  summarize();
  exit(0);
})().catch(error => {
  console.error('\n❌ Фатальная ошибка:', error.message);
  if (verbose) console.error(error);
  summarize();
  exit(1);
});

async function runStep(title, fn) {
  const entry = { title, ok: false, error: null, started: Date.now() };
  try {
    print(`→ ${title}`);
    await withTimeout(fn, timeoutMs);
    entry.ok = true;
    print('  ✔ OK');
  } catch (error) {
    entry.error = error;
    print(`  ✖ ${error.message}`);
    if (verbose) console.error(error);
    throw error;
  } finally {
    entry.duration = Date.now() - entry.started;
    results.push(entry);
  }
}

function fetchAndAssert(url, predicate) {
  return async () => {
    const data = await fetchJson(url);
    const ok = typeof predicate === 'function' ? predicate(data) : true;
    assert(ok, 'получен неожиданный ответ');
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  assert(res.ok, `ожидается 2xx, получено ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('application/json'), 'ожидается JSON ответ');
  return res.json();
}

async function withTimeout(promiseFactory, ms) {
  let timeoutId;
  const timer = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`превышен таймаут ${ms} мс`)), ms);
  });
  return Promise.race([
    (async () => {
      const result = await promiseFactory();
      clearTimeout(timeoutId);
      return result;
    })(),
    timer,
  ]);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeBase(value) {
  return value.replace(/\/$/, '');
}

function print(msg) {
  if (verbose) console.log(msg);
}

function logHeadline(text) {
  console.log(`\n==============================\n${text}\n==============================`);
}

function summarize() {
  if (!results.length) return;
  const ok = results.filter(r => r.ok).length;
  const failed = results.length - ok;
  console.log(`\nИтого: ${ok} ✅  /  ${failed} ❌`);
  for (const result of results) {
    console.log(` - ${result.ok ? '✔' : '✖'} ${result.title} (${result.duration} мс)`);
  }
}
