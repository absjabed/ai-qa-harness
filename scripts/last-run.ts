/**
 * `npm run results:last` — what the last test run did, as the executor needs it.
 *
 * Reads Playwright's report of the last run (`test-results/results.json`) and prints, as JSON:
 *   - the totals, and the stories that ran (from the TCIDs in the test titles);
 *   - the failures, grouped by spec file and by the first line of their error, so thirty failures with one
 *     cause read as one group, not thirty;
 *   - the manual test cases of those stories still Not Run, from `specs/execution/manual-results.csv`.
 *
 * Every figure is read from the files; nothing is estimated. `--text` prints the same as a short summary.
 */

import fs from 'fs';
import path from 'path';
import { eachSpec, type PwReport } from './lib/cycle';
import { parsePlan, planFiles, ROOT, TCID_PREFIX } from './lib/trace';

const LATEST_RUN = path.join(ROOT, 'test-results', 'results.json');
const MANUAL = path.join(ROOT, 'specs', 'execution', 'manual-results.csv');

interface Failure { tcid: string | null; title: string; spec: string; browser: string; status: string; error: string }

/** The first meaningful line of an error, without colour codes or the varying parts. */
function signature(message: string): string {
    const first = message.replace(/\u001b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim()).find(Boolean) ?? 'no error message';
    return first.replace(/\d+ms/g, 'Nms').slice(0, 160);
}

function main(): void {
    if (!fs.existsSync(LATEST_RUN)) {
        console.log(JSON.stringify({ found: false, reason: 'no test-results/results.json — nothing has run yet, or the results were cleared' }, null, 2));
        return;
    }
    const report = JSON.parse(fs.readFileSync(LATEST_RUN, 'utf8')) as PwReport & { stats?: { startTime?: string; expected?: number; unexpected?: number; flaky?: number; skipped?: number } };

    const failures: Failure[] = [];
    const stories = new Set<string>();
    let passed = 0, failed = 0, flaky = 0, skipped = 0;
    for (const spec of eachSpec(report)) {
        const tcid = spec.title.match(TCID_PREFIX)?.[1] ?? null;
        if (tcid) stories.add(tcid.replace(/-TC\d{3}$/, ''));
        for (const test of spec.tests) {
            if (test.status === 'expected') passed++;
            else if (test.status === 'flaky') flaky++;
            else if (test.status === 'skipped') skipped++;
            else {
                failed++;
                const last = (test.results ?? []).slice(-1)[0] as { status?: string; error?: { message?: string } } | undefined;
                failures.push({
                    tcid,
                    title: spec.title,
                    spec: `tests/${spec.file}`.replace(/^tests\/tests\//, 'tests/'),
                    browser: test.projectName ?? '',
                    status: last?.status ?? 'failed',
                    error: signature(last?.error?.message ?? ''),
                });
            }
        }
    }

    // Group by spec and error signature — one row per likely cause.
    const groups = new Map<string, { spec: string; error: string; tests: { tcid: string | null; title: string; browser: string }[] }>();
    for (const f of failures) {
        const key = `${f.spec}\u0000${f.error}`;
        const g = groups.get(key) ?? { spec: f.spec, error: f.error, tests: [] };
        g.tests.push({ tcid: f.tcid, title: f.title, browser: f.browser });
        groups.set(key, g);
    }

    // Manual cases of the stories that ran, still Not Run.
    const manualStatus = new Map<string, string>();
    if (fs.existsSync(MANUAL)) {
        const [head, ...rows] = fs.readFileSync(MANUAL, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(Boolean);
        const cols = head.split(',');
        const iId = cols.indexOf('TCID'), iStatus = cols.indexOf('Status');
        for (const r of rows) {
            const c = r.split(',');
            manualStatus.set(c[iId]?.trim(), c[iStatus]?.trim());
        }
    }
    const manualNotRun = planFiles().map(parsePlan)
        .filter((p) => stories.has(p.storyKey))
        .flatMap((p) => p.cases)
        .filter((c) => !c.retired && c.testType === 'Manual' && (manualStatus.get(c.tcid) ?? 'Not Run') === 'Not Run')
        .map((c) => ({ tcid: c.tcid, summary: c.summary }));

    const out = {
        found: true,
        startedAt: report.stats?.startTime ?? null,
        stories: [...stories].sort(),
        totals: { passed, failed, flaky, skipped },
        failureGroups: [...groups.values()].sort((a, b) => b.tests.length - a.tests.length),
        manualNotRun,
    };

    if (process.argv.includes('--text')) {
        console.log(`Last run ${out.startedAt ?? ''}: ${passed} passed, ${failed} failed, ${flaky} flaky, ${skipped} skipped — stories ${out.stories.join(', ') || 'none traced'}`);
        out.failureGroups.forEach((g, i) => console.log(`  ${i + 1}. ${g.spec} — ${g.tests.length} test(s): ${g.error}\n     ${g.tests.map((t) => `${t.tcid ?? t.title} [${t.browser}]`).join(', ')}`));
        if (manualNotRun.length) console.log(`  Manual cases not run: ${manualNotRun.map((m) => m.tcid).join(', ')}`);
        return;
    }
    console.log(JSON.stringify(out, null, 2));
}

main();
