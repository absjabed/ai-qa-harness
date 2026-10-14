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
 * and records in PROJECT-PROFILE.md section 1 which harness version and commit the copy came from.
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

// The harness's version is written in one place: the newest entry in CHANGELOG.md. It is the harness's
// own, and never the project's — a copy's release versions are its client's, in tests/stories/<release>/.
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const harnessVersion = changelog.match(/^## (\d+\.\d+\.\d+)\b/m)?.[1];
if (!harnessVersion) fail('CHANGELOG.md has no "## <version>" entry, so there is no harness version to record.');

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

// Text files are written with LF line endings — what the repository stores — so the copy's first `git add`
// is not a wall of "CRLF will be replaced by LF" warnings from a Windows checkout of the template.
const BINARY = /\.(png|jpe?g|gif|ico|pdf|woff2?|ttf|zip)$/i;
for (const f of toCopy) {
    const dest = path.join(target, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (BINARY.test(f)) {
        fs.copyFileSync(path.join(root, f), dest);
    } else {
        fs.writeFileSync(dest, fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n'));
    }
}

// package.json — the project's own name, and no export script (a copy has nothing to export). Its version
// is left alone: the harness's version is recorded in the profile, not here, so the two never get mixed up.
const pkgPath = path.join(target, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = projectName;
pkg.description = 'Playwright QA suite.';
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
    [/(\| Harness version this copy started from \| )`[^`]*`[^|]*\|/, `$1\`${harnessVersion}\` |`],
    [/(\| Harness commit this copy started from \| )`[^`]*`[^|]*\|/, `$1\`${commit}\` |`],
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

Playwright QA suite, built on the AI QA harness — harness ${harnessVersion}, commit \`${commit}\`. That is the
harness's version, not this project's: the project's releases are its client's, in \`tests/stories/<release>/\`.

## Start here

- **Setting up:** [docs/NEW-QA-REPO.md](docs/NEW-QA-REPO.md), from section 1 step 3 — the copy is already
  made. [SETUP.md](SETUP.md) is the reference behind each step.
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

// Run the copy's own consistency check against the copy, so a missing file shows up now rather than later.
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
  harness          ${harnessVersion} (${commit})${recorded === 2 ? ' — recorded in PROJECT-PROFILE.md section 1' : ''}
  left behind      ${skipped.join(', ')}
  README.md        ${writeReadme ? 'written for the project' : 'already existed — left as it was'}
  check:docs       ${verified ? 'passed in the copy' : 'FAILED in the copy — see above'}
`);
if (untracked.length) {
    console.log(`  note: ${untracked.length} untracked file(s) in the template were not copied — commit them first if they belong:`);
    untracked.forEach((f) => console.log(`        ${f}`));
    console.log('');
}
if (recorded !== 2) {
    console.log('  note: could not find the harness version/commit rows in PROJECT-PROFILE.md section 1 — fill them by hand.\n');
}
console.log(`Next, in ${target}:

  ${fs.existsSync(path.join(target, '.git')) ? '' : 'git init\n  '}npm install
  npx playwright install

then docs/NEW-QA-REPO.md — the minimum to configure, and the checklist before the context-builder.
Before the first commit, confirm \`git status\` does not list .env or .mcp.json.
`);

process.exit(verified ? 0 : 1);
