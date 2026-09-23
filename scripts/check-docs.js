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

/** Tracked files, so generated and ignored content never affects the result. */
function trackedFiles() {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
}

/**
 * Counting number-words in prose does not work: "three of the five agents" and "all three agents" are
 * both correct English about subsets. So instead of guessing at totals, check the two things that are
 * unambiguous — that every agent is enumerated wherever agents are listed by name, and that the one
 * specific phrasing which states a section total is right.
 */

const NUMBER_WORDS = {
    two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** Files that enumerate the agents by name, and must therefore mention all of them. */
const AGENT_ROSTERS = ['README.md', 'docs/AGENTS.md', 'docs/index.html', 'agents/README.md'];

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

// ---------------------------------------------------------------- profile sections

const profile = read('PROJECT-PROFILE.md');
const sectionCount = [...profile.matchAll(/^## \d+\. /gm)].length;
check('PROJECT-PROFILE.md has no numbered sections', sectionCount > 0, 'expected "## N. Heading" headings');

// ---------------------------------------------------------------- spelled counts in prose

// Every agent must appear wherever agents are listed by name — this is what catches "added an agent,
// forgot to document it", which is the failure that actually happens.
for (const roster of AGENT_ROSTERS) {
    for (const agent of agentFiles.map((f) => f.replace(/\.md$/, ''))) {
        check(`${roster} does not mention ${agent}`, read(roster).includes(agent), 'it enumerates the agents by name');
    }
}

// The one phrasing that states a section total, in the two places that state it.
for (const file of ['SETUP.md', 'docs/index.html']) {
    checkStatedTotal(file, /all (\w+) sections/gi, sectionCount, 'numbered sections in PROJECT-PROFILE.md');
}

// ---------------------------------------------------------------- directory coverage

const componentsDoc = read('docs/COMPONENTS.md');
const readme = read('README.md');

const topDirs = [...new Set(trackedFiles().map((f) => f.split('/')[0]).filter((d) => d.includes('.') === false))];

for (const dir of topDirs) {
    check(
        `docs/COMPONENTS.md never mentions ${dir}/`,
        componentsDoc.includes(`${dir}/`),
        'it claims to cover every file in the harness'
    );
    check(`README.md layout omits ${dir}/`, readme.includes(`${dir}/`), 'the layout block should list it');
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
for (const file of trackedFiles().filter((f) => !f.endsWith('package-lock.json'))) {
    const text = read(file);
    const hit = text.match(BANNED);
    check(
        `${file} contains a term from the originating project`,
        !hit,
        `found "${hit ? hit[0] : ''}" — this template must name no client, product or domain`
    );
}

// ---------------------------------------------------------------- secrets

for (const secret of ['.env', '.mcp.json']) {
    check(`${secret} is tracked in git`, !trackedFiles().includes(secret), 'it carries credentials and must stay ignored');
    if (exists(secret)) notes.push(`${secret} exists locally (correctly untracked)`);
}

// ---------------------------------------------------------------- generator target folder

check(
    'tests/stories/ is missing',
    exists('tests/stories'),
    'generator_write_test cannot create parent folders, so the first story would fail'
);

// ---------------------------------------------------------------- report

if (notes.length) notes.forEach((n) => console.log(`note: ${n}`));

if (failures.length === 0) {
    console.log(`check:docs passed — ${agentFiles.length} agents, ${sectionCount} profile sections, ${topDirs.length} directories.`);
    process.exit(0);
}

console.error(`\ncheck:docs found ${failures.length} problem(s):\n`);
failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
process.exit(1);
