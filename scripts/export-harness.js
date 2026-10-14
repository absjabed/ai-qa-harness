#!/usr/bin/env node
/**
 * `npm run export -- <target-dir>` — copy the harness into a project's QA repository.
 *
 * The alternative is picking files by hand, and that goes wrong in predictable ways: dotfiles are the
 * first thing a manual copy misses, and a copy without `.gitignore` commits `.env` — credentials and
 * all — on its first push. This copies a fixed set instead: every tracked file except the few that
 * describe the template rather than a project.
 *
 * It also does what step 0 of SETUP.md otherwise asks of a person: names the package after the project,
 * and records in PROJECT-PROFILE.md section 1 which template version and commit the copy came from.
 *
 * It never overwrites. If any file it would write already exists in the target, it lists them and
 * writes nothing.
 *
 *   --allow-dirty   copy from a template with uncommitted changes, recording the commit as `<sha>-dirty`
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

/**
 * Tracked files that describe the template, not a project. Everything else is copied.
 * README.md is replaced by one written for the project; the template's history stays with the template.
 */
const TEMPLATE_ONLY = ['README.md', 'CHANGELOG.md', 'scripts/export-harness.js'];

function fail(message) {
    console.error(`\nexport: ${message}\n`);
    process.exit(1);
}

function git(...args) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// ---------------------------------------------------------------- arguments

const args = process.argv.slice(2);
const allowDirty = args.includes('--allow-dirty');
const targetArg = args.find((a) => !a.startsWith('--'));

if (!targetArg) {
    fail('usage: npm run export -- <target-dir> [--allow-dirty]\n\n' +
        '  <target-dir> is the project\'s QA repository — an empty folder, or a fresh clone.');
}

const target = path.resolve(targetArg);
const rel = path.relative(root, target);
if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    fail(`${target} is inside the template. Export to a folder outside it.`);
}

// ---------------------------------------------------------------- provenance

let files;
let commit;
try {
    files = git('ls-files').split('\n').filter(Boolean);
    commit = git('rev-parse', '--short', 'HEAD');
} catch {
    fail('run this from a git checkout of the template — it copies tracked files only, and records the commit.');
}

// Changes to tracked files. Untracked files do not count: only tracked files are copied, so they cannot
// make the recorded commit wrong — they are listed at the end instead.
const dirty = git('status', '--porcelain', '--untracked-files=no').length > 0;
if (dirty && !allowDirty) {
    fail('the template has uncommitted changes, so the commit recorded in the copy would not describe what\n' +
        'was copied. Commit or stash them first — or pass --allow-dirty to record the commit as "-dirty".');
}
if (dirty) commit += '-dirty';

// Only tracked files are copied, so a new file nobody has committed yet would be left out without a
// word — say which.
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);

const templatePkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// A copy should start from a release. Releases are tagged `v<version>`; anything else is work in progress,
// which is allowed but recorded as such, so nobody later mistakes it for the release of the same number.
let releaseTag = null;
try {
    releaseTag = git('describe', '--tags', '--exact-match', 'HEAD');
} catch {
    // not on a tag
}
const released = !dirty && releaseTag === `v${templatePkg.version}`;
const templateVersion = released ? templatePkg.version : `${templatePkg.version} (unreleased)`;

// ---------------------------------------------------------------- plan the copy

const toCopy = files.filter((f) => !TEMPLATE_ONLY.includes(f));

// A folder name is not always a valid package name; make it one.
const projectName =
    path.basename(target).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+|-+$/g, '') || 'qa-tests';

const writeReadme = !fs.existsSync(path.join(target, 'README.md'));

const conflicts = toCopy.filter((f) => fs.existsSync(path.join(target, f)));
if (conflicts.length) {
    fail(`${conflicts.length} file(s) already exist in ${target} — nothing was written:\n\n` +
        conflicts.map((f) => `  ${f}`).join('\n') +
        '\n\nMove or delete them and run again. This never overwrites, so a re-run cannot clobber a configured copy.');
}

// ---------------------------------------------------------------- copy

for (const f of toCopy) {
    const dest = path.join(target, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, f), dest);
}

// package.json — the project's own name, and no export script (a copy has nothing to export).
const pkgPath = path.join(target, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = projectName;
pkg.version = '0.1.0';
pkg.description = `Playwright QA suite, built from the AI QA harness template ${templateVersion} (${commit}).`;
delete pkg.scripts.export;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// package-lock.json carries the name too; keep the two in step so npm does not rewrite it on first install.
const lockPath = path.join(target, 'package-lock.json');
if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.name = projectName;
    lock.version = pkg.version;
    if (lock.packages && lock.packages['']) {
        lock.packages[''].name = projectName;
        lock.packages[''].version = pkg.version;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

// PROJECT-PROFILE.md section 1 — record where this copy came from, while it is still free to know.
const profilePath = path.join(target, 'PROJECT-PROFILE.md');
let profile = fs.readFileSync(profilePath, 'utf8');
const provenance = [
    [/(\| Template version this copy started from \| )`[^`]*`[^|]*\|/, `$1\`${templateVersion}\` |`],
    [/(\| Template commit this copy started from \| )`[^`]*`[^|]*\|/, `$1\`${commit}\` |`],
];
let recorded = 0;
for (const [pattern, replacement] of provenance) {
    if (pattern.test(profile)) {
        profile = profile.replace(pattern, replacement);
        recorded++;
    }
}
fs.writeFileSync(profilePath, profile);

if (writeReadme) {
    fs.writeFileSync(path.join(target, 'README.md'), `# ${projectName}

Playwright QA suite, built on the AI QA harness — template ${templateVersion}, commit \`${commit}\`.

## Start here

- **Setting up:** [SETUP.md](SETUP.md), from step 1 — the copy is already made.
- **Handbook:** \`npm run docs\` — setup, the agents, every component, the day-to-day workflows.
- **What this project is:** [PROJECT-PROFILE.md](PROJECT-PROFILE.md) — roles, vocabulary, modules, test strategy.
- **Rules every test follows:** [TEST-AUTHORING-INVARIANTS.md](TEST-AUTHORING-INVARIANTS.md).

## Agents

Defined in [agents/](agents/), wired into Claude Code by \`.claude/commands/\`:
\`/playwright-context-builder\`, \`/playwright-test-planner\`, \`/playwright-test-generator\`,
\`/playwright-test-healer\`, \`/playwright-defect-raiser\`.

Every story must arrive with its issue key — the planner stops and asks for one if it is missing.

## Commands

\`\`\`bash
npm test                      # run the suite
npm run check                 # typecheck + docs consistency + traceability
npm run report:cycle          # test-cycle closure report
\`\`\`

Credentials live in \`.env\` and MCP servers in \`.mcp.json\`. Both are gitignored — never commit either.
`);
}

// ---------------------------------------------------------------- verify

// Run the copy's own consistency check against the copy, so a missing file shows up now rather than in CI.
let verified = true;
try {
    execFileSync('node', [path.join(target, 'scripts', 'check-docs.js')], { cwd: target, stdio: 'pipe' });
} catch (e) {
    verified = false;
    console.error(String(e.stdout || '') + String(e.stderr || ''));
}

// ---------------------------------------------------------------- report

const skipped = TEMPLATE_ONLY.filter((f) => files.includes(f));
console.log(`
export: copied ${toCopy.length} files into ${target}
  package name     ${projectName}
  template         ${templateVersion} (${commit})${recorded === 2 ? ' — recorded in PROJECT-PROFILE.md section 1' : ''}
  left behind      ${skipped.join(', ')}
  README.md        ${writeReadme ? 'written for the project' : 'already existed — left as it was'}
  check:docs       ${verified ? 'passed in the copy' : 'FAILED in the copy — see above'}
`);
if (untracked.length) {
    console.log(`  note: ${untracked.length} untracked file(s) in the template were not copied — commit them first if they belong:`);
    untracked.forEach((f) => console.log(`        ${f}`));
    console.log('');
}
if (!released) {
    console.log(
        `  note: HEAD is not the release tag v${templatePkg.version}, so this copy is recorded as unreleased.\n` +
        `        For a release, check out its tag first — git checkout v${templatePkg.version} — and export again.\n`
    );
}
if (recorded !== 2) {
    console.log('  note: could not find the template version/commit rows in PROJECT-PROFILE.md section 1 — fill them by hand.\n');
}
console.log(`Next, in ${target}:

  ${fs.existsSync(path.join(target, '.git')) ? '' : 'git init\n  '}npm install
  npx playwright install

then SETUP.md from step 1. Before the first commit, confirm \`git status\` does not list .env or .mcp.json.
`);

process.exit(verified ? 0 : 1);
