/**
 * The test-cycle closure report — built here, used three ways:
 *
 *   npm run report:cycle     by hand, for everything or a chosen scope   (scripts/cycle-report.ts)
 *   after every test run     automatically, for the stories that ran     (lib/cycleReporter.ts)
 *   npm run regression       for the release and tickets you selected    (scripts/regression.ts)
 *
 * It assembles what the harness already produces into one summary: every planned test case in scope and how
 * it ended, pass rates by priority, acceptance-criteria coverage per story, open defects, traceability gaps,
 * and an evaluation of the exit criteria in PROJECT-PROFILE.md section 10.
 *
 * Inputs, all optional — the report says plainly which were missing:
 *   specs/<STORY-KEY>.plan.md              planned test cases, AC → TCID links, release and epic
 *   specs/execution/automated-results.csv  every test case's latest automated result, across runs
 *   test-results/results.json              the latest run — folded into the file above as each run ends
 *   specs/execution/manual-results.csv     manual executions
 *   specs/defects/defect-log.json          defects and their lifecycle status
 *
 * The automated record matters because a cycle is many runs, not one: the regression, then the healer's
 * re-runs of what failed, then a retest. The latest result of each test case is what the cycle reports.
 *
 * Releases here are the project's own — the client release a story ships in. The harness's version never
 * appears in a report.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { projectProfile } from '../../config/projectProfile';
import { NO_RELEASE, parsePlan, Plan, PlannedCase, planFiles, releaseOfSpec, ROOT, storyKeyOf, storySpecFiles, TCID_PREFIX } from './trace';

export type Outcome = 'Passed' | 'Failed' | 'Flaky' | 'Blocked' | 'Skipped' | 'Not Run';

export interface CycleScope {
    /** Only these stories. */
    stories?: string[];
    /** Only stories in these client releases. */
    releases?: string[];
    /** Shown in the report's title and filename, e.g. "release 2.26". Derived from the scope if omitted. */
    label?: string;
    /** Where the results came from, for the report's header — e.g. "automatic, after the run". */
    trigger?: string;
    /** Ignore results executed before this date (`YYYY-MM-DD`) — they count as not run. For a new cycle. */
    since?: string;
    /** Write to specs/execution/closure/, which is committed, instead of reports/. For the cycle's final report. */
    closure?: boolean;
}

export const DEFECT_LOG = 'specs/defects/defect-log.json';
export const AUTOMATED_RECORD = 'specs/execution/automated-results.csv';
const MANUAL_RECORD = 'specs/execution/manual-results.csv';
const LATEST_RUN = 'test-results/results.json';

export interface CycleResult {
    file: string | null;
    cases: number;
    allMet: boolean;
    failingCriteria: string[];
    summary: string;
}

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const has = (p: string) => fs.existsSync(path.join(ROOT, p));
const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 1000) / 10);

/** Every plan, with its release resolved — the plan's `**Release:**`, else the folder its spec lives in. */
export function plansWithRelease(): Plan[] {
    const specRelease = new Map<string, string>();
    for (const f of storySpecFiles()) {
        const release = releaseOfSpec(f);
        if (release) specRelease.set(storyKeyOf(f, '.spec.ts'), release);
    }
    return planFiles()
        .map(parsePlan)
        .map((p) => ({ ...p, release: p.release ?? specRelease.get(p.storyKey) ?? null }));
}

function scopeLabel(scope: CycleScope, plans: Plan[]): string {
    if (scope.label) return scope.label;
    if (scope.releases?.length) return scope.releases.map((r) => (r === NO_RELEASE ? 'no release' : `release ${r}`)).join(', ');
    if (scope.stories?.length) return plans.length === 1 ? plans[0].storyKey : `${plans.length} stories`;
    return 'all stories';
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');

// ---------------------------------------------------------------- automated results

export interface PwAttachment { name: string; contentType: string; path?: string }
export interface PwResult { status: string; attachments?: PwAttachment[] }
export interface PwTest { status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; projectName?: string; annotations?: { type: string }[]; results?: PwResult[] }
export interface PwSpec { title: string; file: string; tests: PwTest[] }
export interface PwSuite { specs?: PwSpec[]; suites?: PwSuite[] }
export interface PwReport { suites?: PwSuite[]; stats?: { startTime?: string; duration?: number } }

/** Every spec in Playwright's JSON report, flattened. */
export function eachSpec(report: PwReport): PwSpec[] {
    const out: PwSpec[] = [];
    const walk = (suites: PwSuite[] = []) => {
        for (const s of suites) {
            out.push(...(s.specs ?? []));
            walk(s.suites);
        }
    };
    walk(report.suites);
    return out;
}

function specOutcome(spec: PwSpec): Outcome {
    const statuses = spec.tests.map((t) => t.status);
    if (statuses.includes('unexpected')) return 'Failed';
    if (statuses.every((s) => s === 'skipped')) {
        const fixme = spec.tests.some((t) => t.annotations?.some((a) => a.type === 'fixme'));
        return fixme ? 'Blocked' : 'Skipped';
    }
    if (statuses.includes('flaky')) return 'Flaky';
    return 'Passed';
}

const RANK: Outcome[] = ['Failed', 'Blocked', 'Flaky', 'Skipped', 'Passed', 'Not Run'];
const worse = (a: Outcome, b: Outcome) => (RANK.indexOf(a) <= RANK.indexOf(b) ? a : b);

/** TCID → outcome, from Playwright's JSON report. Also the count of results with no TCID. */
export function readAutomatedResults(file = LATEST_RUN): {
    outcomes: Map<string, Outcome>;
    specs: Map<string, { file: string; browsers: string[] }>;
    untraced: number;
    started?: string;
    found: boolean;
} {
    const outcomes = new Map<string, Outcome>();
    const specs = new Map<string, { file: string; browsers: string[] }>();
    if (!has(file)) return { outcomes, specs, untraced: 0, found: false };
    let untraced = 0;
    const report = JSON.parse(read(file)) as PwReport;
    for (const spec of eachSpec(report)) {
        const tcid = spec.title.match(TCID_PREFIX)?.[1];
        if (!tcid) { untraced++; continue; }
        const o = specOutcome(spec);
        outcomes.set(tcid, outcomes.has(tcid) ? worse(outcomes.get(tcid)!, o) : o);
        const browsers = [...new Set([...(specs.get(tcid)?.browsers ?? []), ...spec.tests.map((t) => t.projectName ?? '').filter(Boolean)])];
        specs.set(tcid, { file: `tests/${spec.file}`.replace(/^tests\/tests\//, 'tests/'), browsers });
    }
    return { outcomes, specs, untraced, started: report.stats?.startTime, found: true };
}

// ---------------------------------------------------------------- the automated record

interface RecordRow { tcid: string; status: Outcome; executedOn: string; browser: string; build: string; spec: string }
const RECORD_HEADER = ['TCID', 'Status', 'Executed On', 'Browser', 'Build', 'Spec'];

function readRecord(file: string, header: string[]): Map<string, Record<string, string>> {
    const rows = new Map<string, Record<string, string>>();
    if (!has(file)) return rows;
    const [head, ...body] = parseCsv(read(file));
    if (!head) return rows;
    const cols = head.map((h) => h.trim());
    for (const r of body) {
        const row: Record<string, string> = {};
        header.forEach((h) => { row[h] = (r[cols.indexOf(h)] ?? '').trim(); });
        if (row.TCID) rows.set(row.TCID, row);
    }
    return rows;
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * Folds the latest run into specs/execution/automated-results.csv: each test case that ran gets its new
 * result, every other row is kept. Called as each run ends, by lib/cycleReporter.ts.
 */
export function recordAutomatedResults(): { recorded: number; file: string } {
    const latest = readAutomatedResults();
    if (!latest.found || latest.outcomes.size === 0) return { recorded: 0, file: AUTOMATED_RECORD };
    const rows = readRecord(AUTOMATED_RECORD, RECORD_HEADER);
    const executedOn = (latest.started ? new Date(latest.started) : new Date()).toISOString().slice(0, 16).replace('T', ' ');
    const build = process.env.BUILD_UNDER_TEST?.trim() ?? '';
    for (const [tcid, status] of latest.outcomes) {
        const spec = latest.specs.get(tcid);
        const row: RecordRow = { tcid, status, executedOn, browser: spec?.browsers.join(' ') ?? '', build, spec: spec?.file ?? '' };
        rows.set(tcid, { TCID: row.tcid, Status: row.status, 'Executed On': row.executedOn, Browser: row.browser, Build: row.build, Spec: row.spec });
    }
    const sorted = [...rows.values()].sort((a, b) => a.TCID.localeCompare(b.TCID, undefined, { numeric: true }));
    const text = [RECORD_HEADER.join(','), ...sorted.map((r) => RECORD_HEADER.map((h) => csvCell(r[h] ?? '')).join(','))].join('\n') + '\n';
    fs.mkdirSync(path.dirname(path.join(ROOT, AUTOMATED_RECORD)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, AUTOMATED_RECORD), text, 'utf8');
    return { recorded: latest.outcomes.size, file: AUTOMATED_RECORD };
}

// ---------------------------------------------------------------- manual results

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
}

// ---------------------------------------------------------------- the report

interface Defect { id: string; status: string; severity?: string; tcid?: string; storyKey?: string; summary?: string; trackerKey?: string | null }

export function buildCycleReport(scope: CycleScope = {}): CycleResult {
    const inputs: string[] = [];

    // ---- scope
    let plans = plansWithRelease();
    if (scope.releases?.length) plans = plans.filter((p) => scope.releases!.includes(p.release ?? NO_RELEASE));
    if (scope.stories?.length) plans = plans.filter((p) => scope.stories!.includes(p.storyKey));
    const inScope = new Set(plans.map((p) => p.storyKey));
    const label = scopeLabel(scope, plans);

    if (plans.length === 0) {
        return { file: null, cases: 0, allMet: true, failingCriteria: [], summary: `no plans in scope (${label}) — nothing to report` };
    }

    const cases = plans.flatMap((p) => p.cases).filter((c) => !c.retired);
    const retiredCount = plans.flatMap((p) => p.cases).filter((c) => c.retired).length;

    // ---- automated: the record across runs, else the latest run alone
    const storyOf = (id: string) => id.replace(/-TC\d{3}$/, '');
    const fresh = (on: string) => !scope.since || on.slice(0, 10) >= scope.since;
    const auto = readAutomatedResults();
    const automated = new Map<string, Outcome>();
    const executedOn: string[] = [];
    const builds = new Set<string>();
    if (has(AUTOMATED_RECORD)) {
        inputs.push(AUTOMATED_RECORD);
        for (const [id, row] of readRecord(AUTOMATED_RECORD, RECORD_HEADER)) {
            if (!inScope.has(storyOf(id)) || !fresh(row['Executed On'])) continue;
            automated.set(id, row.Status as Outcome);
            executedOn.push(row['Executed On']);
            if (row.Build) builds.add(row.Build);
        }
    } else if (auto.found) {
        inputs.push(LATEST_RUN);
        for (const [id, o] of auto.outcomes) if (inScope.has(storyOf(id))) automated.set(id, o);
    }
    executedOn.sort();

    // ---- manual
    const manual = new Map<string, Outcome>();
    if (has(MANUAL_RECORD)) {
        inputs.push(MANUAL_RECORD);
        for (const [id, row] of readRecord(MANUAL_RECORD, ['TCID', 'Status', 'Executed On'])) {
            const s = row.Status;
            const o: Outcome = s === 'Passed' ? 'Passed' : s === 'Failed' ? 'Failed' : s === 'Blocked' ? 'Blocked' : 'Not Run';
            manual.set(id, o === 'Not Run' || fresh(row['Executed On']) ? o : 'Not Run');
        }
    }

    // ---- defects, in scope
    let defects: Defect[] = [];
    if (has(DEFECT_LOG)) {
        inputs.push(DEFECT_LOG);
        defects = (JSON.parse(read(DEFECT_LOG)) as Defect[]).filter(
            (d) => !d.storyKey || inScope.has(d.storyKey)
        );
    }
    const openDefects = defects.filter((d) => d.status === 'pending' || d.status === 'raised');

    // ---- per-case outcome
    const outcomeOf = (c: PlannedCase): Outcome =>
        c.testType === 'Manual' ? manual.get(c.tcid) ?? 'Not Run' : automated.get(c.tcid) ?? 'Not Run';
    const isPass = (o: Outcome) => o === 'Passed' || o === 'Flaky';
    const outcomes = new Map(cases.map((c) => [c.tcid, outcomeOf(c)]));
    const count = (o: Outcome) => [...outcomes.values()].filter((x) => x === o).length;

    // ---- metrics
    const byPriority = ([1, 2, 3] as const).map((p) => {
        const inP = cases.filter((c) => c.priority === p);
        const passed = inP.filter((c) => isPass(outcomes.get(c.tcid)!)).length;
        return { p, total: inP.length, passed, rate: pct(passed, inP.length) };
    });

    type AcState = 'Passing' | 'Failing' | 'Blocked by defect' | 'Not executed' | 'Not covered';
    const acRows: { story: string; ac: string; ids: string[]; state: AcState }[] = [];
    for (const plan of plans) {
        for (const [ac, ids] of plan.acceptanceCriteria) {
            const live = ids.filter((id) => outcomes.has(id));
            const results = live.map((id) => outcomes.get(id)!);
            const state: AcState =
                live.length === 0 ? 'Not covered'
                : results.some(isPass) ? 'Passing'
                : results.every((o) => o === 'Not Run') ? 'Not executed'
                : results.includes('Failed') ? 'Failing'
                : results.includes('Blocked') ? 'Blocked by defect'
                : 'Failing';
            acRows.push({ story: plan.storyKey, ac, ids, state });
        }
    }
    const acPassing = acRows.filter((r) => r.state === 'Passing').length;
    const notExecuted = count('Not Run');

    const plannedIds = new Set(plans.flatMap((p) => p.cases.map((c) => c.tcid)));
    const orphanResults = [...automated.keys()].filter((id) => !plannedIds.has(id));

    // ---- exit criteria
    const ec = projectProfile.exitCriteria;
    const criteria: { name: string; threshold: string; actual: string; met: boolean }[] = [];
    const p1 = byPriority[0], p2 = byPriority[1];
    criteria.push({ name: 'Priority 1 test cases passing', threshold: `${ec.priority1PassRate}%`, actual: p1.total ? `${p1.rate}% (${p1.passed}/${p1.total})` : 'no P1 cases', met: p1.rate >= ec.priority1PassRate });
    criteria.push({ name: 'Priority 2 test cases passing', threshold: `${ec.priority2PassRate}%`, actual: p2.total ? `${p2.rate}% (${p2.passed}/${p2.total})` : 'no P2 cases', met: p2.rate >= ec.priority2PassRate });
    const acRate = pct(acPassing, acRows.length);
    criteria.push({ name: 'Acceptance criteria with a passing test case', threshold: `${ec.acceptanceCriteriaCoverage}%`, actual: `${acRate}% (${acPassing}/${acRows.length})`, met: acRate >= ec.acceptanceCriteriaCoverage });
    for (const [sev, max] of Object.entries(ec.maxOpenDefects)) {
        const n = openDefects.filter((d) => d.severity === sev).length;
        criteria.push({ name: `Open defects at ${sev}`, threshold: `≤ ${max}`, actual: String(n), met: n <= (max ?? Infinity) });
    }
    criteria.push({ name: 'Test cases not executed', threshold: `≤ ${ec.maxNotExecuted}`, actual: String(notExecuted), met: notExecuted <= ec.maxNotExecuted });
    const allMet = criteria.every((c) => c.met);

    // ---- write
    let commit = 'unknown';
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* not a repo */ }

    const now = new Date();
    const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
    const table = (head: string[], rows: (string | number)[][]) =>
        [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

    const releases = [...new Set(plans.map((p) => p.release ?? '—'))];
    const md: string[] = [];
    md.push(`# Test cycle summary — ${projectProfile.appName} — ${label}`, '');
    md.push(`Generated ${stamp} UTC from commit \`${commit}\`${scope.trigger ? ` — ${scope.trigger}` : ''}.`, '');
    const buildNow = process.env.BUILD_UNDER_TEST?.trim();
    const facts = [
        `Build under test: **${[...new Set([...builds, ...(buildNow ? [buildNow] : [])])].join(', ') || 'not recorded — set `BUILD_UNDER_TEST` in `.env`'}**`,
        executedOn.length ? `automated results from ${executedOn[0]} to ${executedOn[executedOn.length - 1]} UTC` : null,
        scope.since ? `results before ${scope.since} ignored` : null,
    ].filter(Boolean);
    md.push(`${facts.join(' · ')}.`, '');
    if (builds.size > 1) md.push(`> These results come from **${builds.size} different builds**. Re-run what was tested on an older build before closing.`, '');
    md.push(`**Exit criteria: ${allMet ? 'all met' : 'NOT all met'}.** This report states facts; whether to close the cycle is a person's decision.`, '');

    const automatedInput = inputs.includes(LATEST_RUN) ? LATEST_RUN : AUTOMATED_RECORD;
    const missing = [automatedInput, MANUAL_RECORD, DEFECT_LOG].filter((i) => !inputs.includes(i));
    if (missing.length) md.push(`> Inputs not found, treated as empty: ${missing.map((m) => `\`${m}\``).join(', ')}.`, '');

    md.push('## Scope', '');
    md.push(table(['Story', 'Title', 'Release', 'Epic', 'Test cases'], plans.map((p) => [p.storyKey, p.title ?? '—', p.release ?? '—', p.epic ?? '—', p.cases.filter((c) => !c.retired).length])));
    md.push('', `Release${releases.length === 1 ? '' : 's'}: ${releases.join(', ')}.`, '');

    md.push('## Exit criteria', '', table(['Criterion', 'Threshold', 'Actual', 'Met'], criteria.map((c) => [c.name, c.threshold, c.actual, c.met ? 'yes' : '**no**'])), '');

    md.push('## Execution', '');
    md.push(table(['Outcome', 'Test cases'], (['Passed', 'Flaky', 'Failed', 'Blocked', 'Skipped', 'Not Run'] as Outcome[]).map((o) => [o, count(o)])));
    md.push('', `${cases.length} active test cases across ${plans.length} stor${plans.length === 1 ? 'y' : 'ies'}${retiredCount ? `, plus ${retiredCount} retired` : ''}. "Blocked" is a \`test.fixme\` — skipped against a known defect. "Flaky" passed on retry and counts as passing, but is worth a look.`, '');

    md.push('## By priority', '', table(['Priority', 'Test cases', 'Passing', 'Rate'], byPriority.map((r) => [`P${r.p}`, r.total, r.passed, r.total ? `${r.rate}%` : '—'])), '');

    md.push('## Acceptance-criteria coverage', '');
    md.push(acRows.length ? table(['Story', 'AC', 'Test cases', 'State'], acRows.map((r) => [r.story, r.ac, r.ids.join(', ') || '—', r.state === 'Passing' ? r.state : `**${r.state}**`])) : '_No traceability tables found in the plans._');
    md.push('');

    md.push('## Defects', '');
    if (defects.length === 0) md.push('_No defects recorded._');
    else {
        md.push(table(['Status', 'Count'], ['pending', 'raised', 'verified'].map((s) => [s, defects.filter((d) => d.status === s).length])), '');
        if (openDefects.length) md.push(table(['Defect', 'Severity', 'Test case', 'Tracker', 'Summary'], openDefects.map((d) => [d.id, d.severity ?? '?', d.tcid ?? '**untraced**', d.trackerKey ?? '—', d.summary ?? ''])));
    }
    md.push('');

    const failing = cases.filter((c) => ['Failed', 'Blocked', 'Not Run'].includes(outcomes.get(c.tcid)!));
    if (failing.length) {
        md.push('## Test cases not passing', '', table(['TCID', 'Priority', 'Type', 'Outcome', 'Summary'], failing.map((c) => [c.tcid, c.priority ? `P${c.priority}` : '?', c.testType, outcomes.get(c.tcid)!, c.summary])), '');
    }

    md.push('## Traceability', '');
    md.push(`- Results with no TCID in their title: **${auto.untraced}**${auto.untraced ? ' — invisible to coverage above' : ''}`);
    md.push(`- Results whose TCID is in no plan: **${orphanResults.length}**${orphanResults.length ? ` — ${orphanResults.join(', ')}` : ''}`);
    md.push(`- Open defects with no TCID: **${openDefects.filter((d) => !d.tcid).length}**`, '');

    const outDir = path.join(ROOT, scope.closure ? 'specs/execution/closure' : 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const fileStamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const out = path.join(outDir, `cycle-summary-${slug(label)}-${fileStamp}.md`);
    fs.writeFileSync(out, md.join('\n'), 'utf8');

    const failingCriteria = criteria.filter((c) => !c.met).map((c) => c.name);
    return {
        file: path.relative(ROOT, out).split(path.sep).join('/'),
        cases: cases.length,
        allMet,
        failingCriteria,
        summary:
            `${label}: ${cases.length} test cases, ${count('Passed') + count('Flaky')} passing, ${notExecuted} not executed, ` +
            `${openDefects.length} open defect(s); exit criteria ${allMet ? 'all met' : `NOT all met (${failingCriteria.join('; ')})`}`,
    };
}
