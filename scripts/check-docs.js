#!/usr/bin/env node
/**
 * `npm run check:docs` — assert the documentation still matches the repository.
 *
 * The docs restate things the code owns: how many agents there are, how many sections the profile has,
 * which directories exist. Every one of those is a claim that silently goes stale, and a stale claim in a
 * setup guide costs someone an afternoon.
 *
 * This checks only what can be checked mechanically. Prose still needs a reader.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const failures = [];
const notes = [];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

function check(label, condition, detail) {
    if (condition) return;
    failures.push(`${label}\n    ${detail}`);
}

/** Installed or generated — never documentation, whether or not .gitignore is there to say so. */
const GENERATED = /^(node_modules|\.git|test-results|playwright-report|reports|blob-report|allure-\w+|dist)(\/|$)/;
/** Never scanned when walking the tree: generated, installed, or gitignored for carrying secrets. */
const WALK_SKIP = new RegExp(`${GENERATED.source}|^\\.env(?!\\.example$)|^\\.mcp\\.json$`);

let inGit = true;
let tracked;

/**
 * Tracked files, so generated and ignored content never affects the result. A copy fresh from
 * `npm run export` has not been through `git init` yet, so there is nothing tracked — walk the tree
 * instead, skipping what .gitignore would.
 */
function trackedFiles() {
    if (tracked) return tracked;
    try {
        // Tracked files plus untracked ones git does not ignore — so a fresh copy, whose files are not committed
        // yet, is checked in full, while anything .gitignore excludes (.env, results) never is.
        // Secrets are kept in the list on purpose, so the checks below can see one that is committed.
        tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
            .split('\n')
            .filter((f) => f && !GENERATED.test(f));
        if (tracked.length) return tracked;
    } catch {
        // not a git repository
    }
    inGit = false;
    const walk = (dir) =>
        fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
            const p = dir ? `${dir}/${e.name}` : e.name;
            if (WALK_SKIP.test(p)) return [];
            return e.isDirectory() ? walk(p) : [p];
        });
    tracked = walk('');
    return tracked;
}

/**
 * The template and a project copy need different checks. Vendor neutrality and full documentation
 * coverage protect the template; a copy is meant to name its application, adds directories of its own,
 * and has its own README. `npm run export` renames the package, and SETUP.md step 0 asks the same of a
 * copy made any other way.
 */
const TEMPLATE_NAME = 'ai-qa-harness';
const isTemplate = JSON.parse(read('package.json')).name === TEMPLATE_NAME;

/**
 * Counting number-words in prose does not work: "three of the five agents" and "all three agents" are
 * both correct English about subsets. So instead of guessing at totals, check the two things that are
 * unambiguous — that every agent is enumerated wherever agents are listed by name, and that the one
 * specific phrasing which states a section total is right.
 */

const NUMBER_WORDS = {
    two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** Files that enumerate the agents by name, and must therefore mention all of them. A copy's README is its own. */
const AGENT_ROSTERS = ['README.md', 'docs/AGENTS.md', 'docs/index.html', 'agents/README.md'].filter(
    (f) => isTemplate || f !== 'README.md'
);

/** Phrases that genuinely assert a total, with the file they live in. */
function checkStatedTotal(file, pattern, actual, label) {
    if (!exists(file)) return;
    for (const match of read(file).matchAll(pattern)) {
        const claimed = NUMBER_WORDS[match[1].toLowerCase()] ?? Number(match[1]);
        check(
            `${file} says "${match[0].trim()}"`,
            claimed === actual,
            `there are ${actual} ${label}.`
        );
    }
}

// ---------------------------------------------------------------- agents

const agentFiles = fs
    .readdirSync(path.join(root, 'agents'))
    .filter((f) => f.startsWith('playwright-') && f.endsWith('.md'));

const wrapperDir = '.claude/commands';
const wrappers = fs.readdirSync(path.join(root, wrapperDir)).filter((f) => f.endsWith('.md'));

check(
    'agent definitions and Claude wrappers are not paired',
    agentFiles.length === wrappers.length && agentFiles.every((f) => wrappers.includes(f)),
    `agents/: ${agentFiles.join(', ')}\n    ${wrapperDir}/: ${wrappers.join(', ')}`
);

// A wrapper that grows prose is a second copy waiting to drift — that is the whole reason they are thin.
for (const w of wrappers) {
    const body = read(path.join(wrapperDir, w)).split(/^---$/m).slice(2).join('---').trim();
    const canonical = `agents/${w}`;
    check(
        `${wrapperDir}/${w} does not point at its canonical definition`,
        body.includes(canonical),
        `expected a reference to ${canonical}`
    );
    check(
        `${wrapperDir}/${w} has grown instructions of its own`,
        body.split('\n').filter((l) => l.trim()).length <= 8,
        `wrappers stay thin so they cannot drift from agents/. Move the prose into ${canonical}.`
    );
}

// Sub-agents (.claude/agents/) are how one agent starts another in a fresh context — the reviewer, today.
// Same rule as the wrappers: a pointer at the canonical definition, nothing more.
const subagentDir = '.claude/agents';
const subagents = exists(subagentDir) ? fs.readdirSync(path.join(root, subagentDir)).filter((f) => f.endsWith('.md')) : [];
for (const s of subagents) {
    const body = read(path.join(subagentDir, s)).split(/^---$/m).slice(2).join('---').trim();
    const canonical = `agents/${s}`;
    check(`${subagentDir}/${s} has no canonical definition`, agentFiles.includes(s), `expected ${canonical}`);
    check(`${subagentDir}/${s} does not point at its canonical definition`, body.includes(canonical), `expected a reference to ${canonical}`);
    check(`${subagentDir}/${s} has grown instructions of its own`, body.split('\n').filter((l) => l.trim()).length <= 8,
        `sub-agents stay thin so they cannot drift from agents/. Move the prose into ${canonical}.`);
}

// ---------------------------------------------------------------- profile sections

const profile = read('PROJECT-PROFILE.md');
const sectionCount = [...profile.matchAll(/^## \d+\. /gm)].length;
check('PROJECT-PROFILE.md has no numbered sections', sectionCount > 0, 'expected "## N. Heading" headings');

// ---------------------------------------------------------------- spelled counts in prose

// Every agent must appear wherever agents are listed by name — this is what catches "added an agent,
// forgot to document it", which is the failure that actually happens.
for (const roster of AGENT_ROSTERS) {
    if (!isTemplate && !exists(roster)) continue;
    for (const agent of agentFiles.map((f) => f.replace(/\.md$/, ''))) {
        check(`${roster} does not mention ${agent}`, read(roster).includes(agent), 'it enumerates the agents by name');
    }
}

// Two phrasings state a section total: "all eleven sections" and "Eleven sections: application, ...".
for (const file of ['SETUP.md', 'docs/index.html', 'docs/COMPONENTS.md']) {
    checkStatedTotal(file, /all (\w+) sections/gi, sectionCount, 'numbered sections in PROJECT-PROFILE.md');
    checkStatedTotal(file, /\b(\w+) sections:/gi, sectionCount, 'numbered sections in PROJECT-PROFILE.md');
}

// ---------------------------------------------------------------- invariant count

// "I1–I8" is cited across the agents and the docs. Adding an invariant without updating every citation
// leaves agents told to follow a range that stops short of the newest rule. CHANGELOG is exempt: an
// entry describes the version it was written for.
const invariantCount = [...read('TEST-AUTHORING-INVARIANTS.md').matchAll(/^\*\*I(\d+) —/gm)].length;
for (const file of trackedFiles().filter((f) => /\.(md|html|ts)$/.test(f) && f !== 'CHANGELOG.md')) {
    for (const [range, last] of read(file).matchAll(/\bI1[–-]I?(\d+)\b/g)) {
        check(
            `${file} cites "${range}"`,
            Number(last) === invariantCount,
            `TEST-AUTHORING-INVARIANTS.md defines I1–I${invariantCount}.`
        );
    }
}

// ---------------------------------------------------------------- directory coverage

// Template only: a copy adds directories of its own, and COMPONENTS.md describes the template's.
const topDirs = [...new Set(trackedFiles().map((f) => f.split('/')[0]).filter((d) => d.includes('.') === false))];

if (isTemplate) {
    const componentsDoc = read('docs/COMPONENTS.md');
    const readme = read('README.md');
    for (const dir of topDirs) {
        check(
            `docs/COMPONENTS.md never mentions ${dir}/`,
            componentsDoc.includes(`${dir}/`),
            'it claims to cover every file in the harness'
        );
        check(`README.md layout omits ${dir}/`, readme.includes(`${dir}/`), 'the layout block should list it');
    }
}

// ---------------------------------------------------------------- markdown links

for (const file of trackedFiles().filter((f) => f.endsWith('.md'))) {
    const dir = path.dirname(path.join(root, file));
    for (const [, link] of read(file).matchAll(/\]\(([^)#:]+\.md)\)/g)) {
        check(`${file} links to a missing file`, fs.existsSync(path.resolve(dir, link)), link);
    }
}

// ---------------------------------------------------------------- vendor neutrality

const BANNED = /(?!)/; // term list removed
// This file necessarily contains every banned term — it is the list. Exempting it is not a loophole:
// nothing else is exempt, and a term added to BANNED is still enforced everywhere else.
const NEUTRALITY_EXEMPT = ['package-lock.json', 'scripts/check-docs.js'];

// Template only: a project copy is supposed to name its application.
if (isTemplate) {
    for (const file of trackedFiles().filter((f) => !NEUTRALITY_EXEMPT.some((e) => f.endsWith(e)))) {
        const text = read(file);
        const hit = text.match(BANNED);
        check(
            `${file} contains a term from the originating project`,
            !hit,
            `found "${hit ? hit[0] : ''}" — this template must name no client, product or domain. ` +
                `If this is a project copy, not the template, rename "name" in package.json (SETUP.md step 0).`
        );
    }
}

// ---------------------------------------------------------------- secrets

// .gitignore is the file a hand-made copy most often misses, and without it .env is committed on the first push.
const gitignore = exists('.gitignore') ? read('.gitignore').split(/\r?\n/).map((l) => l.trim()) : [];
for (const secret of ['.env', '.mcp.json']) {
    check(`.gitignore does not ignore ${secret}`, gitignore.includes(secret), 'it carries credentials and must never be committed');
    if (inGit) {
        check(`${secret} is tracked in git, or would be on the next commit`, !trackedFiles().includes(secret), 'it carries credentials and must stay ignored');
    }
    if (exists(secret)) notes.push(`${secret} exists locally${inGit ? ' (correctly untracked)' : ''}`);
}

// ---------------------------------------------------------------- generator target folder

check(
    'tests/stories/ is missing',
    exists('tests/stories'),
    'generator_write_test cannot create parent folders, so the first story would fail'
);

// ---------------------------------------------------------------- per-role login seeds

// Agents start from tests/seeds/<role>.spec.ts so they never handle a password. A role added to the
// profile without its seed leaves the agents no way to log in as it, short of reading .env — which
// .claude/settings.json denies.
const rolesSource = read('config/projectProfile.ts').match(/export const roles = \[([^\]]*)\]/);
const profileRoles = rolesSource ? [...rolesSource[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
check('config/projectProfile.ts has no roles array the checker can read', profileRoles.length > 0,
    'expected `export const roles = [...] as const`');
const seedDir = 'tests/seeds';
const seeds = exists(seedDir) ? fs.readdirSync(path.join(root, seedDir)).filter((f) => f.endsWith('.spec.ts')) : [];
for (const role of profileRoles) {
    check(`${seedDir}/${role}.spec.ts is missing`, seeds.includes(`${role}.spec.ts`),
        `every role in config/projectProfile.ts needs a login seed — copy another seed and change the role`);
}
for (const seed of seeds) {
    const role = seed.replace(/\.spec\.ts$/, '');
    check(`${seedDir}/${seed} is for a role the profile does not list`, profileRoles.includes(role),
        'rename it to match a role in config/projectProfile.ts, or delete it');
}

// ---------------------------------------------------------------- context rules cite their source

// A rule in context/<area>.md with no source is indistinguishable from a guess, and every agent downstream
// trusts it. Each numbered rule under "## Invariants" must say where it came from: `source: <document §n /
// issue key / observed / module>`. The template and the guides are exempt; placeholders are skipped.
const CONTEXT_EXEMPT = ['README.md', '_TEMPLATE.md', 'BASELINE.md'];
const contextDocs = exists('context') ? fs.readdirSync(path.join(root, 'context')).filter((f) => f.endsWith('.md') && !CONTEXT_EXEMPT.includes(f)) : [];
for (const doc of contextDocs) {
    const text = read(`context/${doc}`);
    const section = text.split(/^## /m).find((s) => /^Invariants\b/.test(s));
    if (!section) continue;
    const rules = section.split(/^(?=\d+\.\s)/m).filter((r) => /^\d+\.\s/.test(r));
    for (const rule of rules) {
        const first = rule.split('\n')[0].trim();
        if (/^\d+\.\s+`?</.test(first)) continue; // template placeholder
        check(`context/${doc}: invariant "${first.slice(0, 60)}" names no source`, /source:/i.test(rule),
            'end each rule with — source: <document §n | issue key | observed | module>');
    }
}

// ---------------------------------------------------------------- examples still apply

// Template only. An example layer carries changes to harness files, not copies of them, so a template
// change can silently stop one applying — this is where that shows up, before anyone builds a practice repo.
if (isTemplate && exists('examples')) {
    const { checkLayer } = require('./lib/overlay');
    for (const name of fs.readdirSync(path.join(root, 'examples'))) {
        for (const layer of ['qa-setup', 'worked-cycle']) {
            const dir = path.join(root, 'examples', name, layer);
            if (!fs.existsSync(path.join(dir, 'overlay.json'))) continue;
            for (const problem of checkLayer(dir, root)) {
                check(`examples/${name}/${layer} no longer applies`, false, problem);
            }
        }
    }
}

// ---------------------------------------------------------------- harness version

// The harness's version is written in exactly one place — the newest CHANGELOG.md entry — and
// `npm run export` reads it from there. No tags, and not package.json, so it cannot be mistaken for a
// project's release version.
if (isTemplate) {
    check(
        'CHANGELOG.md has no harness version',
        exists('CHANGELOG.md') && /^## \d+\.\d+\.\d+\b/m.test(read('CHANGELOG.md')),
        'expected a "## <major>.<minor>.<patch> — ..." entry; npm run export records it in each copy'
    );
}

// ---------------------------------------------------------------- report

if (notes.length) notes.forEach((n) => console.log(`note: ${n}`));

if (failures.length === 0) {
    const mode = isTemplate ? 'template' : 'project copy';
    console.log(`check:docs passed (${mode}) — ${agentFiles.length} agents, ${sectionCount} profile sections, ${topDirs.length} directories.`);
    process.exit(0);
}

console.error(`\ncheck:docs found ${failures.length} problem(s):\n`);
failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
process.exit(1);
