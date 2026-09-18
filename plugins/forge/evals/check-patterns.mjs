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
//
// It also checks the frontmatter of every grader and every `prompt.md` against
// the harness's schema, and that a shared `fixture.sh` matches its siblings.
// Those three are cheap here and cost about $20 there: each is refused key by
// key, so one typo errors the whole case rather than failing one grader.
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

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    // The key is **any** run of non-space, non-colon characters, not just
    // `[a-z_]+`. The narrower pattern skipped every key it could not spell —
    // `input-match:`, `Match:`, `max2:` — so the unknown-field check below, the
    // whole reason this function collects the fields, never saw the misspelling
    // that `claude plugin eval`'s strict schema then refuses the case over.
    // Silently dropping a key is the one outcome worse than reporting it.
    const kv = line.match(/^([^\s:]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trimEnd().replace(/^["']|["']$/g, '');
  }
  return { fields, body: m[2].trim() };
}

const rel = (file) => path.relative(evalDir, file).split(path.sep).join('/');

// `claude plugin eval` parses grader frontmatter against a strict schema and
// refuses the whole case when one field is off, so a typo in `match`, `flags`,
// `target` or `type` errors a run that costs about $20 rather than failing one
// grader. Nothing else checks them: the pattern check below only looks at
// `type: regex` graders, and it reads the pattern, never the fields around it.
// These sets mirror that schema — keep them in step with it.
const GRADER_TYPES = ['regex', 'tool_order', 'tool_used', 'file_exists', 'llm', 'baseline'];
const TARGETS = ['trace', 'last_message', 'files', 'mock_calls'];

// The schema is **strict**: it rejects a field it does not know, so a misspelt
// *key* is as fatal as a misspelt value — and it fails silently on the way in
// rather than loudly here, because nothing else reads these files. `wieght: 0.5`
// leaves the grader at weight 1 and moves every score in BASELINE.md's table;
// `input_mach: review-design` turns "the skill was never called *for this
// document*" into "the skill was never called at all". Per type, the fields the
// frontmatter may carry (`name` comes from the file name and the pattern or
// rubric from the body, so neither is listed as a frontmatter field here).
const GRADER_FIELDS = {
  regex: ['type', 'name', 'target', 'match', 'flags', 'weight', 'arm'],
  tool_order: ['type', 'name', 'before', 'after', 'weight', 'arm'],
  tool_used: ['type', 'name', 'tool', 'input_match', 'min', 'max', 'weight', 'arm'],
  file_exists: ['type', 'name', 'path', 'exists', 'weight', 'arm'],
  llm: ['type', 'name', 'focus', 'weight', 'arm'],
  baseline: ['type', 'name', 'baseline_file', 'weight', 'arm'],
};

// Which required field each type takes from the body below the frontmatter.
// A type absent from this map reads no body.
const BODY_FIELD = { regex: 'pattern', llm: 'criteria', baseline: 'criteria' };

// A target is one of those four words, or a `{source: file, path: …}` mapping.
const badTarget = (v) =>
  !TARGETS.includes(v) && !/^\{\s*source:\s*file\s*,\s*path:\s*\S/.test(v);

function checkFields(where, fields) {
  const bad = (msg) => failures.push(`${where}: ${msg}`);
  const type = fields.type;
  if (!GRADER_TYPES.includes(type)) {
    bad(`type ${JSON.stringify(type ?? '')} must be one of ${GRADER_TYPES.join(' | ')}`);
    return;
  }
  for (const key of Object.keys(fields)) {
    if (!GRADER_FIELDS[type].includes(key)) {
      bad(`unknown field \`${key}\` for type ${type} — allowed: ${GRADER_FIELDS[type].join(', ')}`);
    }
  }
  if (fields.weight !== undefined && !(Number(fields.weight) > 0)) {
    bad(`weight ${JSON.stringify(fields.weight)} must be a positive number`);
  }
  if (fields.arm !== undefined && !['with-only', 'both'].includes(fields.arm)) {
    bad(`arm ${JSON.stringify(fields.arm)} must be with-only | both`);
  }
  if (type === 'regex') {
    if (fields.target !== undefined && badTarget(fields.target)) {
      bad(`target ${JSON.stringify(fields.target)} must be ${TARGETS.join(' | ')} or {source: file, path: …}`);
    }
    if (fields.match !== undefined && !/^(contains|not_contains|count:\d+)$/.test(fields.match)) {
      bad(`match ${JSON.stringify(fields.match)} must be contains | not_contains | count:N`);
    }
    if (fields.flags !== undefined && !/^[dgimsuvy]*$/.test(fields.flags)) {
      bad(`flags ${JSON.stringify(fields.flags)} must be JS RegExp flags (d g i m s u v y)`);
    }
  }
  if (type === 'llm' && fields.focus !== undefined && badTarget(fields.focus)) {
    bad(`focus ${JSON.stringify(fields.focus)} must be ${TARGETS.join(' | ')} or {source: file, path: …}`);
  }
  if (type === 'tool_used') {
    if (!fields.tool) bad('tool_used needs a `tool`');
    for (const k of ['min', 'max']) {
      if (fields[k] !== undefined && !/^\d+$/.test(fields[k])) {
        bad(`${k} ${JSON.stringify(fields[k])} must be a non-negative integer`);
      }
    }
    // A `max: 0` grader is a "this tool must NOT be called" check, and on
    // `tool: Skill` the harness treats an `arm`-less grader as a plugin-fired
    // *indicator* under `--ablation with-without` — displayed, never scored. So
    // the negative control passes the eye and contributes nothing to the score
    // it was written to defend, and `--threshold` cannot fail on it. `arm: both`
    // is what makes it count; `min` must be stated too, since it defaults to 1.
    if (fields.max === '0') {
      if (fields.min === undefined) bad('a `max: 0` tool_used grader must also set `min: 0` (min defaults to 1)');
      if (fields.arm !== 'both') bad('a `max: 0` tool_used grader must set `arm: both`, or it is displayed but not scored');
    }
  }
  if (type === 'file_exists') {
    if (!fields.path) bad('file_exists needs a `path`');
    if (fields.exists !== undefined && !['true', 'false'].includes(fields.exists)) {
      bad(`exists ${JSON.stringify(fields.exists)} must be true | false`);
    }
  }
}

// `fixture.sh` is duplicated the same way the graders are, and for the same
// reason — `claude plugin eval` reads a scaffold script per case. A shared
// fixture says so in its header comment ("Shared verbatim by A, B and C"), and
// that declaration is the only thing standing between the copies and silent
// drift, so check it here rather than trusting the comment.
// The leading comment block alone, shebang dropped. Reading *every* `#` line
// instead would sweep in the markdown headings of the design documents the
// fixtures write through heredocs (`## 1. Goal`, `# Pricing service`), and the
// case-name scan below would then read a heading such as `## 10-minute TTL` as a
// sibling case and fail a correct suite.
//
// Returned **flattened to one line**: each line's `#` stripped and the lines
// joined with a single space. The marker and the case names after it are prose,
// and prose wraps — `03-companion-spec`'s fixture broke `Shared verbatim by`
// across two `#` lines, so a search over the raw block found nothing, the
// fixture took the "declares no group" branch, and all three copies of that
// fixture were silently exempt from the comparison this file exists to run,
// while it still printed success.
function leadingComment(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('#!')) continue;
    if (line.trim() === '') continue;
    if (!line.startsWith('#')) break;
    lines.push(line.replace(/^#+[ \t]?/, '').trim());
  }
  return lines.join(' ');
}

// Every `#` line in the file, flattened the same way. Used for one question
// only — "is the marker somewhere else in this file?" — where sweeping in a
// heredoc's markdown headings cannot cause a false case name.
function allComments(text) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('#') && !line.startsWith('#!'))
    .map((line) => line.replace(/^#+[ \t]?/, '').trim())
    .join(' ');
}

// The marker is matched on whitespace rather than as a fixed string, so a
// re-wrapped comment keeps working. It is a machine-read identifier: the
// fixtures say so in their own headers, beside the phrase.
const MARKER = /Shared\s+verbatim\s+by/;

function checkFixtures() {
  const fixtures = new Map();
  for (const name of caseDirs()) {
    const file = path.join(evalDir, name, 'fixture.sh');
    if (fs.existsSync(file)) fixtures.set(name, fs.readFileSync(file));
  }
  const declaredBy = new Map();
  for (const [name, body] of fixtures) {
    const text = body.toString('utf8');
    const header = leadingComment(text);
    const at = header.search(MARKER);
    if (at === -1) {
      if (MARKER.test(allComments(text))) {
        failures.push(`${name}/fixture.sh: "Shared verbatim by" must sit in the leading comment block`);
      } else if (/\bshared\b/i.test(header)) {
        // A reworded marker is indistinguishable from "this fixture is not
        // shared", and the group it named then stops being compared with no
        // output at all. Anything that calls itself shared has to use the
        // phrase this file greps for.
        failures.push(`${name}/fixture.sh: its header calls the fixture shared but does not use the exact phrase "Shared verbatim by", which is what names the group — reworded, the drift check silently stops running`);
      }
      continue;
    }
    // Deliberately loose: every name it picks up has to exist as a case with a
    // fixture, so a false hit fails loudly rather than passing silently. The
    // tail must start with a letter, which keeps a date such as `2026-01-10`
    // in the header from reading as a case named `01-10`.
    const declared = [...new Set(header.slice(at).match(/\b\d{2}-[a-z][a-z0-9-]*\b/g) ?? [])];
    if (!declared.includes(name)) {
      failures.push(`${name}/fixture.sh: "Shared verbatim by" does not list its own case`);
      continue;
    }
    const siblings = new Set();
    for (const other of declared) {
      if (other === name) continue;
      if (!fixtures.has(other)) {
        failures.push(`${name}/fixture.sh: names ${other}, which has no fixture.sh`);
      } else {
        siblings.add(other);
      }
    }
    declaredBy.set(name, siblings);
  }

  // Every member of a shared group names every other member, so disagreeing
  // lists are themselves the defect — and they are what lets drift hide.
  // Driving the comparison off one side's list alone (the earlier member's, say)
  // means an edit that both changes a fixture and drops a sibling from its own
  // header is never compared against that sibling: the sibling still names it,
  // but nothing reads that direction. Check the declarations both ways, and pair
  // off an unordered pair whenever *either* side names the other — still once
  // per pair, so one drifted fixture is still one failure.
  for (const [name, siblings] of declaredBy) {
    for (const other of siblings) {
      if (!declaredBy.get(other)?.has(name)) {
        failures.push(`${other}/fixture.sh: "Shared verbatim by" does not list ${name}, which lists it — a shared group names all of its members`);
      }
    }
  }
  const compared = new Set();
  for (const [name, siblings] of declaredBy) {
    for (const other of siblings) {
      const [lo, hi] = name < other ? [name, other] : [other, name];
      if (compared.has(`${lo}|${hi}`)) continue;
      compared.add(`${lo}|${hi}`);
      if (!fixtures.get(lo).equals(fixtures.get(hi))) {
        failures.push(`${hi}/fixture.sh: differs from ${lo}/fixture.sh — shared fixtures must be identical copies`);
      }
    }
  }
}

// `prompt.md`'s frontmatter is refused key by key, and by name: an unrecognised
// key is not ignored, it errors the case ("unknown frontmatter key"). The two
// sets below are the harness's own — a top-level group and an execution group,
// merged from the same file — so `max_turn:` or `allowed-tools:` costs the run
// exactly what a misspelt grader field does.
const PROMPT_TOP = ['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome'];
const PROMPT_EXECUTION = ['model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'artifact_publish',
  'growthbook_overrides', 'append_system_prompt', 'env'];

function checkPrompts() {
  for (const name of caseDirs()) {
    const file = path.join(evalDir, name, 'prompt.md');
    if (!fs.existsSync(file)) continue;
    const parsed = parse(fs.readFileSync(file, 'utf8'));
    // No frontmatter at all is legal — every key has a default, or comes from
    // case.yaml — so there is nothing to check.
    if (!parsed) continue;
    for (const key of Object.keys(parsed.fields)) {
      if (!PROMPT_TOP.includes(key) && !PROMPT_EXECUTION.includes(key)) {
        failures.push(`${name}/prompt.md: unknown frontmatter key \`${key}\` — allowed: ${[...PROMPT_TOP, ...PROMPT_EXECUTION].join(', ')}`);
      }
    }
    if (parsed.body === '') failures.push(`${name}/prompt.md: empty body — the prompt is what the case runs`);
  }
}

checkFixtures();
checkPrompts();

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
  const parsed = parse(first.toString('utf8'));
  if (!parsed) {
    failures.push(`${rel(files[0])}: no frontmatter`);
    continue;
  }
  checkFields(rel(files[0]), parsed.fields);
  // Claimed before the body check below, so a regex grader that fails that
  // check does not also collect a "has samples but no regex grader" failure
  // from the sweep at the end for the same one defect.
  if (parsed.fields.type === 'regex') seen.add(name);
  // The body fills one required schema field, and which one depends on the
  // type. An empty body leaves that field unset, and the schema has no default
  // for it, so the case is refused — the same $20 error a misspelt field
  // causes. `tool_used` and `file_exists` read no body at all.
  const bodyField = BODY_FIELD[parsed.fields.type];
  if (bodyField !== undefined && parsed.body === '') {
    failures.push(`${rel(files[0])}: empty body — this \`${parsed.fields.type}\` grader's \`${bodyField}\` is read from the body below the frontmatter, and the schema requires it`);
    continue;
  }
  if (parsed.fields.type !== 'regex') continue;
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
