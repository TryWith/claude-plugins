#!/usr/bin/env node
// Checks every `type: regex` grader in this eval suite against the samples in
// pattern-samples.json. A `match: not_contains` or `match: "count:0"` grader
// passes an eval run whenever its pattern finds nothing, including when the
// pattern itself is broken, so no eval run can reveal a mistyped one. This can.
//
// Usage: node check-patterns.mjs [eval-dir]   (default: this file's directory)
//
// A grader's pattern is the body of its file, below the frontmatter, trimmed.
// pattern-samples.json maps a grader's file name, such as
// "verdict-line-not-ready.md", to { "match": [...], "no_match": [...] }.
// "match" lists strings the pattern must find; for a not_contains or count:0
// grader those are the violations it exists to catch.
//
// The same grader appears in several cases as a copy — `claude plugin eval`
// reads graders per case, with no suite-wide sharing. Copies drift, so every
// grader file (of any type) that shares a name with another must be
// byte-identical to it, and the samples are keyed by that shared name.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evalDir = path.resolve(process.argv[2] ?? path.dirname(fileURLToPath(import.meta.url)));
const failures = [];

function caseDirs() {
  return fs.readdirSync(evalDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'results' && e.name !== 'mocks')
    .map((e) => e.name)
    .sort();
}

function graderFiles() {
  const files = [];
  for (const name of caseDirs()) {
    const dir = path.join(evalDir, name, 'graders');
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (file.endsWith('.md')) files.push(path.join(dir, file));
    }
  }
  return files;
}

function parse(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trimEnd().replace(/^["']|["']$/g, '');
  }
  return { fields, body: m[2].trim() };
}

const rel = (file) => path.relative(evalDir, file).split(path.sep).join('/');

// `fixture.sh` is duplicated the same way the graders are, and for the same
// reason — `claude plugin eval` reads a scaffold script per case. A shared
// fixture says so in its header comment ("Shared verbatim by A, B and C"), and
// that declaration is the only thing standing between the copies and silent
// drift, so check it here rather than trusting the comment.
function checkFixtures() {
  for (const name of caseDirs()) {
    const file = path.join(evalDir, name, 'fixture.sh');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const header = text.split('\n').filter((l) => l.startsWith('#')).join('\n');
    const at = header.indexOf('Shared verbatim by');
    if (at === -1) continue;
    const declared = [...new Set(header.slice(at).match(/\b\d{2}-[a-z0-9-]+\b/g) ?? [])];
    if (!declared.includes(name)) {
      failures.push(`${name}/fixture.sh: "Shared verbatim by" does not list its own case`);
      continue;
    }
    const body = fs.readFileSync(file);
    for (const other of declared) {
      if (other === name) continue;
      const otherFile = path.join(evalDir, other, 'fixture.sh');
      if (!fs.existsSync(otherFile)) {
        failures.push(`${name}/fixture.sh: names ${other}, which has no fixture.sh`);
      } else if (!fs.readFileSync(otherFile).equals(body)) {
        failures.push(`${other}/fixture.sh: differs from ${name}/fixture.sh — shared fixtures must be identical copies`);
      }
    }
  }
}

checkFixtures();

// Group by file name; the first copy of each name is the one checked.
const byName = new Map();
for (const file of graderFiles()) {
  const name = path.basename(file);
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(file);
}

const samples = JSON.parse(fs.readFileSync(path.join(evalDir, 'pattern-samples.json'), 'utf8'));
const seen = new Set();
let graders = 0;
let checks = 0;

for (const [name, files] of byName) {
  const first = fs.readFileSync(files[0]);
  for (const other of files.slice(1)) {
    if (!fs.readFileSync(other).equals(first)) {
      failures.push(`${rel(other)}: differs from ${rel(files[0])} — same-named graders must be identical copies`);
    }
  }
  const parsed = parse(files[0]);
  if (!parsed) {
    failures.push(`${rel(files[0])}: no frontmatter`);
    continue;
  }
  if (parsed.fields.type !== 'regex') continue;
  seen.add(name);
  if (parsed.body === '') {
    failures.push(`${rel(files[0])}: empty pattern (the body below the frontmatter)`);
    continue;
  }
  let re;
  try {
    // Drop `g` and `y`: one `RegExp` is reused across every sample below, and
    // those two flags make `test()` stateful through `lastIndex`, so samples
    // would pass or fail by position. Neither changes whether the pattern
    // matches at all, which is all this check is about.
    re = new RegExp(parsed.body, (parsed.fields.flags ?? '').replace(/[gy]/g, ''));
  } catch (err) {
    failures.push(`${rel(files[0])}: pattern does not compile: ${err.message}`);
    continue;
  }
  const s = samples[name];
  if (!s || !Array.isArray(s.match) || s.match.length === 0 || !Array.isArray(s.no_match) || s.no_match.length === 0) {
    failures.push(`${name}: needs at least one "match" and one "no_match" sample in pattern-samples.json`);
    continue;
  }
  graders++;
  for (const [want, list] of [[true, s.match], [false, s.no_match]]) {
    for (const text of list) {
      checks++;
      if (re.test(text) !== want) {
        failures.push(`${name}: expected ${want ? 'a match' : 'no match'} on ${JSON.stringify(text)}`);
      }
    }
  }
}

for (const key of Object.keys(samples)) {
  if (!seen.has(key)) failures.push(`${key}: has samples but no regex grader has that file name`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`check-patterns: ${graders} regex graders, ${checks} samples OK`);
