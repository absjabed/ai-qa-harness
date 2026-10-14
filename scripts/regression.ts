/**
 * `npm run regression` — regression for a client release, on the tickets you choose.
 *
 * Asks which release, then which of its tickets — all of them, by epic, or one by one — runs their tests,
 * and writes the cycle report for exactly that selection. Releases are the project's own (`**Release:**` in
 * each plan, or the `tests/stories/<release>/` folder its spec lives in); the harness's version has nothing
 * to do with them.
 *
 * In a terminal it asks. Anywhere else — or to repeat a run — pass the answers as flags:
 *
 *   npm run regression -- --release 2.26                         every ticket in the release
 *   npm run regression -- --release 2.26 --epics PROJ-100        tickets in these epics
 *   npm run regression -- --release 2.26 --stories PROJ-12,PROJ-15
 *   npm run regression -- --release 2.26 --all-tests             not only tests tagged @Regression
 *   npm run regression -- --release 2.26 --browser chromium      one Playwright project (browser)
 *   npm run regression -- --release none                         tickets with no release yet
 *   npm run regression -- --release all                          every release — the full regression
 *
 * A release's own tickets are what changed in it; the earlier releases' tests are what it might have
 * broken. Picking several releases, or all of them, runs both.
 *
 * `--release` and the other list flags take comma-separated values and can be repeated. `--yes` skips the
 * final confirmation.
 */

import 'dotenv/config';
import readline from 'readline/promises';
import { spawnSync } from 'child_process';
import { buildCycleReport, plansWithRelease } from './lib/cycle';
import { NO_RELEASE, rel, releaseOfSpec, ROOT, storyKeyOf, storySpecFiles, type Plan } from './lib/trace';

const args = process.argv.slice(2);
const values = (flag: string) =>
    args.flatMap((a, i) => (a === flag && args[i + 1] ? args[i + 1].split(',') : [])).map((s) => s.trim()).filter(Boolean);
const flag = (name: string) => args.includes(name);
const option = (name: string) => values(name)[0];

const interactive = process.stdin.isTTY && process.stdout.isTTY;

function fail(message: string): never {
    console.error(`\nregression: ${message}\n`);
    process.exit(1);
}

/** 2.9 before 2.10, and 2.26 before 2.26.1. */
function compareReleases(a: string, b: string): number {
    const pa = a.split(/[^0-9]+/).filter(Boolean).map(Number);
    const pb = b.split(/[^0-9]+/).filter(Boolean).map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? -1) - (pb[i] ?? -1);
        if (d) return d;
    }
    return a.localeCompare(b);
}

interface Ticket {
    key: string;
    title: string;
    release: string;
    epic: string | null;
    spec: string | null;
    automated: number;
    manual: number;
}

function collectTickets(): Ticket[] {
    const plans = new Map<string, Plan>(plansWithRelease().map((p) => [p.storyKey, p]));
    const specs = new Map<string, string>();
    for (const f of storySpecFiles()) specs.set(storyKeyOf(f, '.spec.ts'), f);

    const keys = new Set([...plans.keys(), ...specs.keys()]);
    const tickets: Ticket[] = [];
    for (const key of keys) {
        const plan = plans.get(key);
        const spec = specs.get(key) ?? null;
        // No release yet is a release of its own for selection: listed last, chosen with `--release none`.
        const release = plan?.release ?? (spec ? releaseOfSpec(spec) : null) ?? NO_RELEASE;
        const active = plan?.cases.filter((c) => !c.retired) ?? [];
        tickets.push({
            key,
            title: plan?.title ?? '(no plan)',
            release,
            epic: plan?.epic ?? null,
            spec: spec ? rel(spec) : null,
            automated: active.filter((c) => c.testType !== 'Manual').length,
            manual: active.filter((c) => c.testType === 'Manual').length,
        });
    }
    return tickets.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

async function main(): Promise<void> {
    const tickets = collectTickets();
    const named = [...new Set(tickets.map((t) => t.release).filter((r) => r !== NO_RELEASE))].sort(compareReleases);
    const releases = tickets.some((t) => t.release === NO_RELEASE) ? [...named, NO_RELEASE] : named;
    if (releases.length === 0) {
        fail('no tickets found. A ticket comes from a plan in specs/ or a spec under tests/stories/.');
    }
    const shown = (r: string) => (r === NO_RELEASE ? 'no release yet' : r);

    const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
    const ask = async (q: string, fallback = '') => (rl ? ((await rl.question(q)).trim() || fallback) : fallback);
    const pickNumbers = async (q: string, count: number): Promise<number[]> => {
        const answer = await ask(q);
        const picked = answer.split(',').map((s) => Number(s.trim()) - 1).filter((n) => Number.isInteger(n) && n >= 0 && n < count);
        return [...new Set(picked)];
    };

    // ---- release
    let chosenReleases = values('--release');
    if (chosenReleases.includes('all')) chosenReleases = releases;
    if (chosenReleases.length) {
        const unknown = chosenReleases.filter((r) => !releases.includes(r));
        if (unknown.length) fail(`no tickets in release ${unknown.join(', ')}. Known releases: ${releases.join(', ')}.`);
    } else if (rl) {
        console.log('\nReleases:');
        releases.forEach((r, i) => console.log(`  ${i + 1}. ${shown(r)}  (${tickets.filter((t) => t.release === r).length} tickets)`));
        const latest = named.length ? named[named.length - 1] : releases[0];
        const answer = await ask(`Which release? Numbers, comma-separated, or "all" for every release [${shown(latest)}]: `);
        const picked = answer.split(',').map((s) => Number(s.trim()) - 1).filter((n) => Number.isInteger(n) && n >= 0 && n < releases.length);
        chosenReleases = answer.toLowerCase() === 'all' ? releases : picked.length ? [...new Set(picked)].map((i) => releases[i]) : [latest];
    } else {
        fail(`not a terminal, so pass the release: --release <one of ${releases.join(', ')}>.`);
    }

    let pool = tickets.filter((t) => chosenReleases.includes(t.release));

    // ---- tickets
    const byEpics = values('--epics');
    const byStories = values('--stories');
    if (byEpics.length) pool = pool.filter((t) => t.epic && byEpics.includes(t.epic));
    if (byStories.length) pool = pool.filter((t) => byStories.includes(t.key));

    if (!byEpics.length && !byStories.length && rl) {
        console.log(`\nTickets in ${chosenReleases.map(shown).join(', ')}:`);
        pool.forEach((t, i) =>
            console.log(`  ${i + 1}. ${t.key}  ${t.title}${t.epic ? `  [epic ${t.epic}]` : ''}  — ${t.automated} automated, ${t.manual} manual${t.spec ? '' : ', no spec yet'}`)
        );
        const mode = (await ask('\nRun [a]ll of them, pick by [e]pic, or pick [t]ickets? [a]: ', 'a')).toLowerCase();
        if (mode.startsWith('e')) {
            const epics = [...new Set(pool.map((t) => t.epic ?? '(no epic)'))];
            epics.forEach((e, i) => console.log(`  ${i + 1}. ${e}  (${pool.filter((t) => (t.epic ?? '(no epic)') === e).length} tickets)`));
            const picked = await pickNumbers('Which epics? Numbers, comma-separated: ', epics.length);
            const chosen = picked.map((i) => epics[i]);
            pool = pool.filter((t) => chosen.includes(t.epic ?? '(no epic)'));
        } else if (mode.startsWith('t')) {
            const picked = await pickNumbers('Which tickets? Numbers, comma-separated: ', pool.length);
            pool = picked.map((i) => pool[i]);
        }
    }

    if (pool.length === 0) fail('that selection has no tickets in it.');

    // ---- what to run
    let regressionOnly = !flag('--all-tests');
    if (rl && !flag('--all-tests')) {
        regressionOnly = !(await ask('Only tests tagged @Regression? [Y/n]: ', 'y')).toLowerCase().startsWith('n');
    }
    const files = pool.filter((t) => t.spec).map((t) => t.spec!);
    const noSpec = pool.filter((t) => !t.spec);
    const project = option('--browser');

    const label = chosenReleases.map((r) => (r === NO_RELEASE ? 'no release' : `release ${r}`)).join(', ') + (pool.length < tickets.filter((t) => chosenReleases.includes(t.release)).length ? ` — ${pool.length} ticket${pool.length === 1 ? '' : 's'}` : '');

    console.log(`\nRegression: ${label}`);
    console.log(`  tickets   ${pool.map((t) => t.key).join(', ')}`);
    console.log(`  tests     ${regressionOnly ? 'tagged @Regression' : 'all'}`);
    console.log(`  browsers  ${project ?? 'every browser project in playwright.config.ts — pass --browser <name> for one'}`);
    console.log(`  build     ${process.env.BUILD_UNDER_TEST?.trim() || 'not recorded — set BUILD_UNDER_TEST in .env to name the build under test'}`);
    if (noSpec.length) console.log(`  no spec   ${noSpec.map((t) => t.key).join(', ')} — reported from manual results only`);

    if (rl && !flag('--yes')) {
        if ((await ask('Run it? [Y/n]: ', 'y')).toLowerCase().startsWith('n')) {
            rl.close();
            console.log('Nothing run.');
            return;
        }
    }
    rl?.close();

    const scope = {
        stories: pool.map((t) => t.key),
        label,
        trigger: `regression run, ${regressionOnly ? 'tests tagged @Regression only — untagged ones show as not executed' : 'all tests'}`,
    };

    if (files.length === 0) {
        const result = buildCycleReport({ ...scope, trigger: 'regression with no automated specs — manual results only' });
        console.log(`\nNothing automated to run. Cycle report — ${result.summary}.${result.file ? `\n  ${result.file}` : ''}`);
        return;
    }

    // Playwright's own CLI, run by this Node — avoids depending on a shell or on npx being on PATH.
    const cli = require.resolve('@playwright/test/cli');
    const pwArgs = ['test', ...files, ...(regressionOnly ? ['--grep', '@Regression'] : []), ...(project ? ['--project', project] : [])];
    const run = spawnSync(process.execPath, [cli, ...pwArgs], {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, CYCLE_REPORT_SCOPE: JSON.stringify(scope) },
    });

    // The cycle report was written by lib/cycleReporter.ts as the run finished, scoped to this selection.
    if (process.env.AUTO_CYCLE_REPORT === 'false') {
        const result = buildCycleReport(scope);
        console.log(`\nCycle report — ${result.summary}.${result.file ? `\n  ${result.file}` : ''}`);
    }
    process.exit(run.status ?? 1);
}

main().catch((error) => fail((error as Error).message));
