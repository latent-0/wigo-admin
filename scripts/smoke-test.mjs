#!/usr/bin/env node
/**
 * End-to-end smoke test. Boots the real server on the fake adapters and exercises the
 * critical paths the way the daily reports describe: OTP login happy path, KPI read,
 * WhatsApp send, and idempotent top-up. No live credentials required.
 */
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = join(root, 'server');
const PORT = process.env.SMOKE_PORT || '4599';
const BASE = `http://localhost:${PORT}`;

const env = {
  ...process.env,
  PORT,
  NODE_ENV: 'development',
  WHATSAPP_DRIVER: 'fake',
  N1CO_DRIVER: 'fake',
  CORS_ORIGINS: 'http://localhost:5173',
};

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✖ ${name} ${detail}`);
  }
}

// Every request has a hard timeout so a wedged server can never hang the harness.
function jfetch(path, init = {}) {
  return fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
}

async function waitForHealth(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await jfetch('/health');
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Kill the spawned server and its whole process tree (tsx spawns a child node). */
function killTree(child) {
  if (!child || child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

async function main() {
  console.log(`\nWIGO admin smoke test → ${BASE}\n`);
  let serverErr = '';
  const child = spawn('npx tsx src/index.ts', {
    cwd: serverDir,
    env,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr?.on('data', (d) => {
    serverErr += d.toString();
  });

  let exitCode = 1;
  try {
    const up = await waitForHealth();
    check('server boots and /health responds', up, serverErr.slice(0, 200));
    if (!up) throw new Error('server did not start');

    const health = await (await jfetch('/health')).json();
    check('health reports fake drivers', health.drivers?.whatsapp === 'fake' && health.drivers?.n1co === 'fake');

    const phone = '+5215500000001';
    const otp = await (
      await jfetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
    ).json();
    check('OTP request returns a dev code (fake driver)', typeof otp.devCode === 'string');

    const verify = await (
      await jfetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp.devCode }),
      })
    ).json();
    check('OTP verify returns a super_admin session', verify.user?.role === 'super_admin');
    const token = verify.accessToken;
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const kpis = await (await jfetch('/api/kpis', { headers: auth })).json();
    check('KPIs exclude the soft-deleted rider (total = 8)', kpis.riders?.total === 8, `got ${kpis.riders?.total}`);

    const unauth = await jfetch('/api/kpis');
    check('KPIs require auth (401 without token)', unauth.status === 401);

    const send = await jfetch('/api/notifications/send', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ to: '+5215515590000', templateName: 'application_approved', params: { name: 'Ana', city: 'CDMX' } }),
    });
    const sendBody = await send.json();
    check('WhatsApp send succeeds via fake adapter', send.status === 201 && sendBody.status === 'sent');

    const key = `smoke-${Date.now()}`;
    const topupBody = { riderId: 'rdr_002', amountCents: 2500, currency: 'MXN', idempotencyKey: key };
    const first = await (await jfetch('/api/payments/deposits/topup', { method: 'POST', headers: auth, body: JSON.stringify(topupBody) })).json();
    const second = await (await jfetch('/api/payments/deposits/topup', { method: 'POST', headers: auth, body: JSON.stringify(topupBody) })).json();
    check('top-up is idempotent (same deposit id, replay flag)', first.deposit?.id === second.deposit?.id && second.idempotentReplay === true);

    const audit = await (await jfetch('/api/audit', { headers: auth })).json();
    check('audit log recorded actions', Array.isArray(audit.items) && audit.items.length > 0);

    console.log(`\n${failed === 0 ? '✔ PASS' : '✖ FAIL'} — ${passed} passed, ${failed} failed\n`);
    exitCode = failed === 0 ? 0 : 1;
  } catch (err) {
    console.error('Smoke test error:', err.message);
    if (serverErr) console.error(serverErr.slice(0, 500));
    exitCode = 1;
  } finally {
    killTree(child);
  }

  // Flush stdout before exiting so piped output is never truncated.
  process.exitCode = exitCode;
  await new Promise((r) => setTimeout(r, 200));
}

main();
