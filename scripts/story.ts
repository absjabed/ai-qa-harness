/**
 * `npm run story` — the git side of working on a story, so every agent and every tester does it the same way.
 * The agent runs it; the QA team member answers its questions. See docs/GIT-WORKFLOW.md.
 *
 *   npm run story -- status [<KEY>…] [--json]
 *       Where each story is, worked out from the files every time — plan, reviews, spec, results, defects,
 *       branches — and whether it may merge. Nothing is stored that could drift. No key: the story of the
 *       current branch, else every story.
 *
 *   npm run story -- start <KEY> ["<short description>"] [--release <x>|none] [--base <branch>] [--resume] [--yes]
 *       The story start protocol: a clean working tree, a fetch, an offer to resume the story's existing
 *       branch, an explicit base branch, a fast-forward pull of it (stops if it has diverged), then
 *       `test/<KEY>-<description>`. Without --base it suggests one and stops: the person chooses.
 *       Without --yes it shows what it would do and changes nothing.
 *
 *   npm run story -- switch <branch> [--yes]
 *       A clean working tree, a fetch, then the branch checked out and fast-forwarded — before a regression on
 *       `release/<x>`, or to pick up another branch. Stops if it has diverged.
 *
 *   npm run story -- release-start <x> [--from develop] [--yes]
 *       Creates `release/<x>` from the freshly pulled `develop` at the start of a release cycle, and lists the
 *       stories with no release yet, to check against Jira's fix version. Pushing it is asked separately.
 *
 *   npm run story -- finish <KEY> [--into <branch>] [--yes]
 *       Before a story merges: checks the merge rule (tests generated, reviewed and run — open defects and
 *       fixme included), brings the latest base branch into the story's branch, and lists shared files that
 *       changed there, so the tests can be re-run. Then prints the push and pull-request steps — each asked.
 *
 * It never pushes, merges into a shared branch, deletes a branch or rewrites history.
 */

import { spawnSync } from 'child_process';
import { AUTOMATED_RECORD, MANUAL_RECORD, RECORD_HEADER, plansWithRelease, readRecord } from './lib/cycle';
import { readDefects } from './lib/defects';
import { NO_RELEASE, Plan, ROOT, rel, storyKeyOf, storySpecFiles } from './lib/trace';

// ---------------------------------------------------------------- git

function git(...args: string[]): { ok: boolean; out: string; err: string } {
    const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
    return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

const REMOTE = 'origin';
const hasRemote = () => git('remote').out.split('\n').includes(REMOTE);
const localBranch = (b: string) => git('rev-parse', '--verify', '--quiet', `refs/heads/${b}`).ok;
const remoteBranch = (b: string) => git('rev-parse', '--verify', '--quiet', `refs/remotes/${REMOTE}/${b}`).ok;
const branchExists = (b: string) => localBranch(b) || remoteBranch(b);
const currentBranch = () => git('rev-parse', '--abbrev-ref', 'HEAD').out;
const hasUpstream = () => git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}').ok;

function branchesMatching(prefix: string): string[] {
    const refs = git('for-each-ref', '--format=%(refname)', 'refs/heads/', `refs/remotes/${REMOTE}/`).out.split('\n');
    const names = refs
        .map((r) => r.replace(/^refs\/heads\//, '').replace(new RegExp(`^refs/remotes/${REMOTE}/`), ''))
        .filter((b) => b.startsWith(prefix));
    return [...new Set(names)].sort();
}

const storyBranches = (key: string) => branchesMatching(`test/${key}-`).concat(branchExists(`test/${key}`) ? [`test/${key}`] : []);
const releaseBranches = () => branchesMatching('release/');

/** The story key of a `test/<KEY>-...` branch, or null. */
function keyOfBranch(branch: string): string | null {
    const m = branch.match(/^test\/([A-Z][A-Z0-9]*-\d+)(?:-|$)/);
    return m ? m[1] : null;
}

function dirtyFiles(): string[] {
    return git('status', '--porcelain').out.split('\n').filter(Boolean);
}

function fetch(): string | null {
    if (!hasRemote()) return `no remote "${REMOTE}" — working locally, nothing fetched`;
    const f = git('fetch', '--prune', REMOTE);
    if (!f.ok) throw new Stop(`git fetch failed:\n${f.err}`);
    return null;
}

/** Check out a branch (tracking the remote one if only that exists), then fast-forward it. */
function checkoutAndPull(branch: string): void {
    const c = git('checkout', branch);
    if (!c.ok) throw new Stop(`could not check out ${branch}:\n${c.err}`);
    if (!hasRemote() || !hasUpstream()) return;
    const p = git('pull', '--ff-only');
    if (!p.ok) {
        throw new Stop(
            `${branch} has diverged from ${REMOTE}/${branch} — it cannot be fast-forwarded, so nothing more was done.\n` +
            `You are on ${branch}. A person sorts this out; never force it.\n` +
            p.err.split('\n').filter((l) => !l.startsWith('hint:')).join('\n')
        );
    }
}

// ---------------------------------------------------------------- arguments

class Stop extends Error {
    constructor(message: string, readonly code = 1) { super(message); }
}

const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name: string) => argv.includes(name);
function option(name: string): string | undefined {
    const i = argv.indexOf(name);
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}
const valued = new Set(['--release', '--base', '--from', '--into']);
const positional = argv.slice(1).filter((a, i, all) => !a.startsWith('--') && !valued.has(all[i - 1] ?? ''));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
const KEY = /^[A-Z][A-Z0-9]*-\d+$/;

// ---------------------------------------------------------------- status

interface StoryStatus {
    key: string;
    title: string | null;
    release: string | null;
    epic: string | null;
    plan: string | null;
    planReviewed: string | null;
    specs: string[];
    testsReviewed: string | null;
    automated: { planned: number; run: number; passed: number; failed: number; blocked: number; skipped: number; lastRun: string | null };
    manual: { planned: number; notRun: number };
    openDefects: string[];
    branches: string[];
    stage: string;
    merge: { ready: boolean; why: string[] };
}

function statusOf(key: string, plans: Plan[]): StoryStatus {
    const plan = plans.find((p) => p.storyKey === key) ?? null;
    const specs = storySpecFiles().filter((f) => storyKeyOf(f, '.spec.ts') === key).map(rel);
    const cases = (plan?.cases ?? []).filter((c) => !c.retired);
    const autoCases = cases.filter((c) => c.testType !== 'Manual');
    const manualCases = cases.filter((c) => c.testType === 'Manual');

    const auto = readRecord(AUTOMATED_RECORD, RECORD_HEADER);
    const manual = readRecord(MANUAL_RECORD, ['TCID', 'Status', 'Executed On']);
    const rows = autoCases.map((c) => auto.get(c.tcid)).filter((r): r is Record<string, string> => !!r);
    const ran = rows.filter((r) => r.Status !== 'Skipped');
    const count = (s: string) => rows.filter((r) => r.Status === s).length;
    const lastRun = rows.map((r) => r['Executed On']).sort().pop() ?? null;

    const openDefects = readDefects().entries
        .filter((d) => d.storyKey === key && (d.status === 'pending' || d.status === 'raised'))
        .map((d) => `${d.id}${d.trackerKey ? ` (${d.trackerKey})` : ''} ${d.status}`);

    const automated = {
        planned: autoCases.length, run: ran.length, passed: count('Passed') + count('Flaky'), failed: count('Failed'),
        blocked: count('Blocked'), skipped: count('Skipped'), lastRun,
    };
    const manualNotRun = manualCases.filter((c) => (manual.get(c.tcid)?.Status ?? 'Not Run') === 'Not Run').length;

    let stage: string;
    if (!plan) stage = 'not planned';
    else if (!specs.length) stage = plan.planReviewed ? 'plan reviewed' : 'planned';
    else if (!plan.testsReviewed) stage = 'tests generated, not reviewed';
    else if (automated.run < automated.planned) stage = automated.run ? `tests reviewed, ${automated.planned - automated.run} of ${automated.planned} not run yet` : 'tests reviewed, not run';
    else if (automated.failed || openDefects.length) stage = `run — ${automated.failed} failing, ${openDefects.length} open defect(s)`;
    else stage = 'run — passing';

    const why: string[] = [];
    if (!plan) why.push('no plan');
    if (!specs.length && autoCases.length) why.push('no spec — tests not generated');
    if (plan && specs.length && !plan.testsReviewed) why.push('tests not reviewed (no **Tests reviewed:** line in the plan)');
    if (automated.run < automated.planned) why.push(`${automated.planned - automated.run} automated test case(s) not run`);

    return {
        key, title: plan?.title ?? null, release: plan?.release ?? null, epic: plan?.epic ?? null,
        plan: plan?.file ?? null, planReviewed: plan?.planReviewed ?? null, specs, testsReviewed: plan?.testsReviewed ?? null,
        automated, manual: { planned: manualCases.length, notRun: manualNotRun }, openDefects,
        branches: storyBranches(key), stage, merge: { ready: why.length === 0, why },
    };
}

function printStatus(s: StoryStatus): void {
    const a = s.automated;
    console.log(`${s.key}${s.title ? ` — ${s.title}` : ''}`);
    console.log(`  release      ${s.release ?? 'none yet — not in any release regression until scheduled'}${s.epic ? `   epic ${s.epic}` : ''}`);
    console.log(`  stage        ${s.stage}`);
    console.log(`  plan         ${s.plan ?? '—'}${s.plan ? (s.planReviewed ? `, reviewed ${s.planReviewed}` : ', not reviewed') : ''}`);
    console.log(`  tests        ${s.specs.join(', ') || '—'}${s.specs.length ? (s.testsReviewed ? `, reviewed ${s.testsReviewed}` : ', not reviewed') : ''}`);
    if (a.planned) console.log(`  automated    ${a.run}/${a.planned} run — ${a.passed} passed, ${a.failed} failed, ${a.blocked} blocked${a.skipped ? `, ${a.skipped} skipped` : ''}${a.lastRun ? `; last ${a.lastRun} UTC` : ''}`);
    if (s.manual.planned) console.log(`  manual       ${s.manual.planned - s.manual.notRun}/${s.manual.planned} executed`);
    console.log(`  defects      ${s.openDefects.length ? s.openDefects.join('; ') : 'none open'}`);
    console.log(`  branches     ${s.branches.join(', ') || '—'}`);
    console.log(`  may merge    ${s.merge.ready ? 'yes' : `no — ${s.merge.why.join('; ')}`}`);
}

function status(): void {
    const plans = plansWithRelease();
    let keys = positional.filter((k) => KEY.test(k));
    if (!keys.length) {
        const k = keyOfBranch(currentBranch());
        keys = k ? [k] : plans.map((p) => p.storyKey).sort();
    }
    const all = keys.map((k) => statusOf(k, plans));
    if (flag('--json')) {
        console.log(JSON.stringify({ branch: currentBranch(), stories: all }, null, 2));
        return;
    }
    if (!all.length) {
        console.log('No stories yet — no plans in specs/.');
        return;
    }
    console.log(`On branch ${currentBranch()}\n`);
    all.forEach((s, i) => { if (i) console.log(''); printStatus(s); });
    const noRelease = all.filter((s) => !s.release && s.plan).map((s) => s.key);
    if (noRelease.length > 1 || (noRelease.length && all.length > 1)) console.log(`\nNot in a release yet: ${noRelease.join(', ')}`);
}

// ---------------------------------------------------------------- start

function start(): void {
    const key = positional[0];
    if (!key || !KEY.test(key)) throw new Stop('usage: npm run story -- start <KEY> ["<short description>"] [--release <x>|none] [--base <branch>] [--yes]');

    // 1. A clean working tree, so nothing half-done is carried onto the new branch.
    const dirty = dirtyFiles();
    if (dirty.length) {
        throw new Stop(`The working tree has uncommitted changes — commit or put them aside first, then start again:\n  ${dirty.join('\n  ')}`);
    }
    // 2. The latest from the remote.
    const note = fetch();
    if (note) console.log(`note: ${note}`);

    // 3. An existing branch for this story: offer to resume it, never start a second one.
    const existing = storyBranches(key);
    if (existing.length && !flag('--resume')) {
        throw new Stop(
            `${key} already has a branch: ${existing.join(', ')}.\n` +
            `Resume it: npm run story -- start ${key} --resume --yes`, 3);
    }
    if (flag('--resume')) {
        const branch = existing[0];
        if (!branch) throw new Stop(`${key} has no branch to resume — start it without --resume.`);
        if (!flag('--yes')) {
            console.log(`Would check out ${branch} and fast-forward it from ${REMOTE}. Run again with --yes.`);
            return;
        }
        checkoutAndPull(branch);
        console.log(`Resumed ${branch}.\n`);
        printStatus(statusOf(key, plansWithRelease()));
        return;
    }

    // 4. The base: the person chooses. Suggest release/<x> for the story's release, else develop.
    const plan = plansWithRelease().find((p) => p.storyKey === key);
    const releaseFlag = option('--release');
    const release = releaseFlag ? (releaseFlag === NO_RELEASE ? null : releaseFlag) : plan?.release ?? null;
    const releaseKnown = !!releaseFlag || !!plan;
    const suggested = release && branchExists(`release/${release}`) ? `release/${release}` : 'develop';
    const base = option('--base');
    if (!base) {
        const lines = [`Choose the base branch for ${key}.`];
        lines.push(`  suggested  ${suggested}${release ? ` (release ${release})` : ''}`);
        const bases = ['develop', ...releaseBranches()].filter(branchExists);
        lines.push(`  available  ${bases.join(', ') || 'none — create develop from main first'}`);
        if (release && !branchExists(`release/${release}`)) lines.push(`  release/${release} does not exist yet — create it with: npm run story -- release-start ${release}`);
        if (!releaseKnown) lines.push(`  ${key}'s release is not known yet — pass --release <fix version>, or --release none.`);
        if (releaseKnown && !release) lines.push(noReleaseNotice(key));
        lines.push(`Then: npm run story -- start ${key} "<short description>" --base <branch> --yes`);
        throw new Stop(lines.join('\n'), 3);
    }
    if (!branchExists(base)) throw new Stop(`There is no branch ${base}, locally or on ${REMOTE}.`);

    const description = positional[1] ?? plan?.title ?? '';
    const branch = description ? `test/${key}-${slug(description)}` : `test/${key}`;
    if (!flag('--yes')) {
        console.log(`Would: check out ${base}, fast-forward it from ${REMOTE}, then create ${branch} from it.`);
        if (!release && base === 'develop') console.log(noReleaseNotice(key));
        console.log('Run again with --yes.');
        return;
    }

    // 5. The base, freshly pulled — stop if it has diverged. 6. The story's branch.
    checkoutAndPull(base);
    const c = git('checkout', '-b', branch);
    if (!c.ok) throw new Stop(`could not create ${branch}:\n${c.err}`);
    console.log(`Started ${branch} from ${base} (${git('rev-parse', '--short', 'HEAD').out}).`);
    if (!release && base === 'develop') console.log(noReleaseNotice(key));
    console.log(`Commits: <type>(${key}): <what> [<stage>] — see docs/GIT-WORKFLOW.md.`);
}

const noReleaseNotice = (key: string) =>
    `  ${key} has no release yet: it branches from develop and merges back into develop, and is in no release's ` +
    `regression until it is scheduled.`;

// ---------------------------------------------------------------- switch

function switchTo(): void {
    const branch = positional[0];
    if (!branch) throw new Stop('usage: npm run story -- switch <branch> [--yes]');
    const dirty = dirtyFiles();
    if (dirty.length) throw new Stop(`The working tree has uncommitted changes — commit or put them aside first:\n  ${dirty.join('\n  ')}`);
    const note = fetch();
    if (note) console.log(`note: ${note}`);
    if (!branchExists(branch)) throw new Stop(`There is no branch ${branch}, locally or on ${REMOTE}.`);
    if (!flag('--yes')) {
        console.log(`Would check out ${branch} and fast-forward it from ${REMOTE}. Run again with --yes.`);
        return;
    }
    checkoutAndPull(branch);
    console.log(`On ${branch}, up to date (${git('rev-parse', '--short', 'HEAD').out}).`);
}

// ---------------------------------------------------------------- release-start

function releaseStart(): void {
    const x = positional[0];
    if (!x || /\s|\.\.|^[-/]|[~^:?*[\\]/.test(x)) throw new Stop('usage: npm run story -- release-start <release, e.g. 2.27> [--from develop] [--yes]');
    const from = option('--from') ?? 'develop';
    const branch = `release/${x}`;

    const dirty = dirtyFiles();
    if (dirty.length) throw new Stop(`The working tree has uncommitted changes — commit or put them aside first:\n  ${dirty.join('\n  ')}`);
    const note = fetch();
    if (note) console.log(`note: ${note}`);
    if (branchExists(branch)) throw new Stop(`${branch} already exists — stories branch from it: npm run story -- start <KEY> --base ${branch}`);
    if (!branchExists(from)) throw new Stop(`There is no ${from} branch to start the release from.`);

    const noRelease = plansWithRelease().filter((p) => !p.release).map((p) => p.storyKey).sort();
    if (!flag('--yes')) {
        console.log(`Would: check out ${from}, fast-forward it from ${REMOTE}, then create ${branch} from it. Run again with --yes.`);
    } else {
        checkoutAndPull(from);
        const c = git('checkout', '-b', branch);
        if (!c.ok) throw new Stop(`could not create ${branch}:\n${c.err}`);
        console.log(`Created ${branch} from ${from} (${git('rev-parse', '--short', 'HEAD').out}).`);
        if (hasRemote()) console.log(`Not pushed. To share it: git push -u ${REMOTE} ${branch}`);
    }
    if (noRelease.length) {
        console.log(`\nStories with no release yet: ${noRelease.join(', ')}.`);
        console.log(`Check Jira for any that now carry fix version ${x}; each one brought in gets **Release:** ${x} in its plan and its spec moved to tests/stories/${x}/.`);
    }
}

// ---------------------------------------------------------------- finish

/** Files outside a story's own plan, spec and records — a change to one can affect every story's tests. */
const isShared = (f: string) => !/^(specs\/|tests\/stories\/|docs\/|reports\/|context\/)/.test(f) && !/\.md$/.test(f);

function finish(): void {
    const branch = currentBranch();
    const key = positional[0] ?? keyOfBranch(branch);
    if (!key || !KEY.test(key)) throw new Stop('usage: npm run story -- finish <KEY> [--into <branch>] [--yes], on the story\'s branch');
    if (keyOfBranch(branch) !== key) throw new Stop(`You are on ${branch}, not ${key}'s branch (${storyBranches(key).join(', ') || 'none'}). Check it out first.`);

    const dirty = dirtyFiles();
    if (dirty.length) throw new Stop(`Commit the story's work first — uncommitted:\n  ${dirty.join('\n  ')}`);

    const s = statusOf(key, plansWithRelease());
    if (!s.merge.ready) throw new Stop(`${key} may not merge yet: ${s.merge.why.join('; ')}.`);

    let into = option('--into');
    if (!into) {
        if (s.release && !branchExists(`release/${s.release}`)) {
            throw new Stop(`${key} is in release ${s.release}, but release/${s.release} does not exist. Create it (npm run story -- release-start ${s.release}) or pass --into develop.`);
        }
        into = s.release ? `release/${s.release}` : 'develop';
    }
    if (!branchExists(into)) throw new Stop(`There is no branch ${into}.`);

    const note = fetch();
    if (note) console.log(`note: ${note}`);
    const baseRef = remoteBranch(into) ? `${REMOTE}/${into}` : into;
    const mergeBase = git('merge-base', 'HEAD', baseRef).out;
    const behind = Number(git('rev-list', '--count', `HEAD..${baseRef}`).out || 0);
    const changed = behind ? git('diff', '--name-only', mergeBase, baseRef).out.split('\n').filter(Boolean) : [];
    const shared = changed.filter(isShared);

    console.log(`${key} may merge into ${into}: tests generated, reviewed and run${s.openDefects.length ? `; ${s.openDefects.length} open defect(s) go with it, as they should` : ''}.`);
    console.log(`  ${into} is ${behind} commit(s) ahead of this branch.`);
    if (shared.length) console.log(`  Shared files changed there — re-run ${key}'s tests after bringing them in:\n    ${shared.join('\n    ')}`);

    if (!flag('--yes')) {
        console.log(behind ? `Would merge ${baseRef} into ${branch}. Run again with --yes.` : 'Nothing to bring in.');
        return;
    }
    if (behind) {
        const m = git('merge', '--no-edit', baseRef);
        if (!m.ok) {
            const conflicts = git('diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
            throw new Stop(
                `Merging ${baseRef} stopped on conflicts:\n  ${conflicts.join('\n  ')}\n` +
                `Resolve them with the person, then commit — or undo the merge: git merge --abort`);
        }
        console.log(`Brought ${baseRef} into ${branch}.`);
    }
    console.log('\nNext, each asked first:');
    if (shared.length) console.log(`  1. re-run the tests:  npm run regression -- --stories ${key} --all-tests --yes`);
    console.log(`  ${shared.length ? 2 : 1}. push:            git push -u ${REMOTE} ${branch}`);
    console.log(`  ${shared.length ? 3 : 2}. pull request:    into ${into}, titled "test(${key}): ${s.title ?? 'tests'} [ready-to-merge]"`);
}

// ---------------------------------------------------------------- main

try {
    if (!git('rev-parse', '--is-inside-work-tree').ok) throw new Stop('Not a git repository — run git init first (docs/GIT-WORKFLOW.md).');
    if (command === 'status') status();
    else if (command === 'start') start();
    else if (command === 'switch') switchTo();
    else if (command === 'release-start') releaseStart();
    else if (command === 'finish') finish();
    else throw new Stop('usage: npm run story -- status | start <KEY> | switch <branch> | release-start <x> | finish <KEY>   (see scripts/story.ts)');
} catch (e) {
    if (e instanceof Stop) {
        console.error(e.message);
        process.exit(e.code);
    }
    throw e;
}
