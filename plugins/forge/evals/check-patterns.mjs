#!/usr/bin/env node
// Checks every `type: regex` grader in this eval suite against the samples in
// pattern-samples.json. A `match: not_contains` or `match: "count:0"` grader
// passes an eval run whenever its pattern finds nothing, including when the
// pattern itself is broken, so no eval run can reveal a mistyped one. This can.
//
// Usage: node check-patterns.mjs [eval-dir]   (default: this file's directory)
//
// pattern-samples.json maps a grader path relative to the eval directory, such
// as "_shared/graders/verdict-once.md", to { "match": [...], "no_match": [...] }.
// "match" lists strings the pattern must find; for a not_contains or count:0
// grader those are the violations it exists to catch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evalDir = path.resolve(process.argv[2] ?? path.dirname(fileURLToPath(import.meta.url)));
const sharedDir = path.join(evalDir, '_shared', 'graders');
const failures = [];

function graderFiles() {
  const files = [];
  for (const entry of fs.readdirSync(evalDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'results') continue;
    const dir = entry.name === '_shared' ? sharedDir : path.join(evalDir, entry.name, 'graders');
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith('.md')) files.push(path.join(dir, name));
    }
  }
  return files;
}

// A case's copy of a shared grader is checked once, through the shared file:
// either a symlink to it, or a byte-identical copy when symlinks are not
// followed by `claude plugin eval` (BASELINE.md, Harness notes V1).
function isSharedCopy(file) {
  if (path.dirname(file) === sharedDir) return false;
  const shared = path.join(sharedDir, path.basename(file));
  if (!fs.existsSync(shared)) return false;
  if (fs.realpathSync(file) === fs.realpathSync(shared)) return true;
  return fs.readFileSync(file).equals(fs.readFileSync(shared));
}

function frontmatter(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trimEnd();
  }
  return fields;
}

const samplesPath = path.join(evalDir, 'pattern-samples.json');
const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf8'));
const seen = new Set();
let graders = 0;
let checks = 0;

for (const file of graderFiles()) {
  if (isSharedCopy(file)) continue;
  const key = path.relative(evalDir, file).split(path.sep).join('/');
  const fields = frontmatter(file);
  if (!fields || fields.type !== 'regex') continue;
  seen.add(key);
  const raw = fields.pattern ?? '';
  // Single quotes only: in a double-quoted YAML scalar `\d`, `\b` and friends
  // are escape sequences, so the eval would read a different pattern than this.
  if (!/^'.*'$/.test(raw)) {
    failures.push(`${key}: pattern must be a single-quoted YAML scalar`);
    continue;
  }
  const source = raw.slice(1, -1).replace(/''/g, "'");
  const flags = (fields.flags ?? '').replace(/^["']|["']$/g, '');
  let re;
  try {
    re = new RegExp(source, flags);
  } catch (err) {
    failures.push(`${key}: pattern does not compile: ${err.message}`);
    continue;
  }
  const s = samples[key];
  if (!s || !Array.isArray(s.match) || s.match.length === 0 || !Array.isArray(s.no_match) || s.no_match.length === 0) {
    failures.push(`${key}: needs at least one "match" and one "no_match" sample in pattern-samples.json`);
    continue;
  }
  graders++;
  for (const [want, list] of [[true, s.match], [false, s.no_match]]) {
    for (const text of list) {
      checks++;
      if (re.test(text) !== want) {
        failures.push(`${key}: expected ${want ? 'a match' : 'no match'} on ${JSON.stringify(text)}`);
      }
    }
  }
}

for (const key of Object.keys(samples)) {
  if (!seen.has(key)) failures.push(`${key}: has samples but no regex grader exists at that path`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`check-patterns: ${graders} regex graders, ${checks} samples OK`);
