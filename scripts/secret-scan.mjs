#!/usr/bin/env node
/**
 * Lightweight secret scanner run before every push (the "secret scan before push"
 * discipline from the 11 Sep report). Fails the build if a likely credential or a
 * committed .env is found in tracked source. Deliberately dependency-free.
 */
import { readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ALLOWLISTED_FILES = new Set(['.env.example', 'server/.env.example', 'web/.env.example']);
const SKIP_DIRS = ['node_modules/', 'dist/', 'build/', '.git/', 'coverage/'];

const PATTERNS = [
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Meta/WhatsApp long-lived token', re: /\bEAA[0-9A-Za-z]{60,}\b/ },
  { name: 'Generic bearer secret assignment', re: /(?:secret|token|api[_-]?key|password)\s*[:=]\s*['"][A-Za-z0-9+/_\-]{24,}['"]/i },
];

function trackedFiles() {
  // Union of tracked files and untracked-but-not-ignored files, so the scan is
  // meaningful before the first commit as well as before every push.
  try {
    const tracked = execSync('git ls-files', { encoding: 'utf8' });
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
    const all = `${tracked}\n${untracked}`.split('\n').map((s) => s.trim()).filter(Boolean);
    return [...new Set(all)];
  } catch {
    return [];
  }
}

const findings = [];
const files = trackedFiles();

for (const file of files) {
  if (SKIP_DIRS.some((d) => file.startsWith(d) || file.includes(`/${d}`))) continue;

  // A committed .env (anything named .env or .env.<x> that isn't an example) is a fail.
  const baseName = file.split('/').pop() ?? file;
  if ((baseName === '.env' || baseName.startsWith('.env.')) && !ALLOWLISTED_FILES.has(file) && !file.endsWith('.example')) {
    findings.push({ file, name: 'Committed .env file', line: 0 });
    continue;
  }
  if (ALLOWLISTED_FILES.has(file)) continue;

  let content;
  try {
    if (statSync(file).size > 1_000_000) continue; // skip large/binary files
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) findings.push({ file, name, line: i + 1 });
    }
  });
}

if (findings.length > 0) {
  console.error('✖ Secret scan FAILED — potential secrets found:\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.name}`);
  }
  console.error('\nRemove the secret, move it to an env var, and re-run.');
  process.exit(1);
}

console.log(`✔ Secret scan clean — ${files.length} tracked files checked, no secrets found.`);
