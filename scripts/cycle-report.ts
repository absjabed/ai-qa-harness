/**
 * `npm run report:cycle` — the STLC test-cycle closure report.
 *
 * Assembles what the harness already produces into one summary: every planned test case and how it ended,
 * pass rates by priority, acceptance-criteria coverage per story, open defects, traceability gaps, and an
 * evaluation of the exit criteria in PROJECT-PROFILE.md section 10.
 *
 * Inputs, all optional — the report says plainly which ones were missing:
 *   specs/<STORY-KEY>.plan.md           planned test cases and AC → TCID links
 *   test-results/results.json           the latest automated run (Playwright's JSON reporter)
 *   specs/execution/manual-results.csv  manual executions
 *   specs/temp-defects/defect-log.json  defects and their lifecycle status
 *
 * Writes reports/cycle-summary-<YYYY-MM-DD>.md. `--strict` exits non-zero when an exit criterion is not
 * met, for use as a gate; by default it only reports, because the release decision belongs to a person.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { projectProfile } from '../config/projectProfile';
import { parsePlan, planFiles, PlannedCase, ROOT, TCID_PREFIX } from './lib/trace';

type Outcome = 'Passed' | 'Failed' | 'Flaky' | 'Blocked' | 'Skipped' | 'Not Run';

const strict = process.argv.includes('--strict');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const has = (p: string) => fs.existsSync(path.join(ROOT, p));
const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 1000) / 10);
const inputs: string[] = [];

// ---------------------------------------------------------------- plans

const plans = planFiles().map(parsePlan);
const cases = plans.flatMap((p) => p.cases).filter((c) => !c.retired);
const retiredCount = plans.flatMap((p) => p.cases).filter((c) => c.retired).length;

if (plans.length === 0) {
    console.log('report:cycle — no plans in specs/, so there is no cycle to report on yet.');
    process.exit(0);
}

// ---------------------------------------------------------------- automated results

interface PwTest { status: 'expected' | 'unexpected' | 'flaky' | 'skipped'; annotations?: { type: string }[] }
interface PwSpec { title: string; file: string; tests: PwTest[] }
interface PwSuite { specs?: PwSpec[]; suites?: PwSuite[] }
interface PwReport { suites?: PwSuite[]; stats?: { startTime?: string; duration?: number } }

const automated = new Map<string, Outcome>();
let untracedResults = 0;
let runStarted: string | undefined;

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

if (has('test-results/results.json')) {
    inputs.push('test-results/results.json');
    const report = JSON.parse(read('test-results/results.json')) as PwReport;
    runStarted = report.stats?.startTime;
    const walkSuites = (suites: PwSuite[] = []) => {
        for (const s of suites) {
            for (const spec of s.specs ?? []) {
                const tcid = spec.title.match(TCID_PREFIX)?.[1];
                if (!tcid) { untracedResults++; continue; }
                const o = specOutcome(spec);
                automated.set(tcid, automated.has(tcid) ? worse(automated.get(tcid)!, o) : o);
            }
            walkSuites(s.suites);
        }
    };
    walkSuites(report.suites);
}

// ---------------------------------------------------------------- manual results

const manual = new Map<string, Outcome>();

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

if (has('specs/execution/manual-results.csv')) {
    inputs.push('specs/execution/manual-results.csv');
    const [header, ...rows] = parseCsv(read('specs/execution/manual-results.csv'));
    const iId = header.indexOf('TCID'), iStatus = header.indexOf('Status');
    for (const r of rows) {
        const s = (r[iStatus] ?? '').trim();
        const o: Outcome = s === 'Passed' ? 'Passed' : s === 'Failed' ? 'Failed' : s === 'Blocked' ? 'Blocked' : 'Not Run';
        manual.set((r[iId] ?? '').trim(), o);
    }
}

// ---------------------------------------------------------------- defects

interface Defect { id: string; status: string; severity?: string; tcid?: string; storyKey?: string; summary?: string; trackerKey?: string | null }
let defects: Defect[] = [];
if (has('specs/temp-defects/defect-log.json')) {
    inputs.push('specs/temp-defects/defect-log.json');
    defects = JSON.parse(read('specs/temp-defects/defect-log.json')) as Defect[];
}
const openDefects = defects.filter((d) => d.status === 'pending' || d.status === 'raised');

// ---------------------------------------------------------------- per-case outcome

const outcomeOf = (c: PlannedCase): Outcome =>
    c.testType === 'Manual' ? manual.get(c.tcid) ?? 'Not Run' : automated.get(c.tcid) ?? 'Not Run';

const isPass = (o: Outcome) => o === 'Passed' || o === 'Flaky';
const outcomes = new Map(cases.map((c) => [c.tcid, outcomeOf(c)]));
const count = (o: Outcome) => [...outcomes.values()].filter((x) => x === o).length;

// ---------------------------------------------------------------- metrics

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

// ---------------------------------------------------------------- exit criteria

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

// ---------------------------------------------------------------- write

let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* not a repo */ }

const today = new Date().toISOString().slice(0, 10);
const table = (head: string[], rows: (string | number)[][]) =>
    [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const md: string[] = [];
md.push(`# Test cycle summary — ${projectProfile.appName}`, '');
md.push(`Generated ${today} from commit \`${commit}\`${runStarted ? `, automated run started ${runStarted}` : ''}.`, '');
md.push(`**Exit criteria: ${allMet ? 'all met' : 'NOT all met'}.** This report states facts; whether to close the cycle is a person's decision.`, '');

const missing = ['test-results/results.json', 'specs/execution/manual-results.csv', 'specs/temp-defects/defect-log.json'].filter((i) => !inputs.includes(i));
if (missing.length) md.push(`> Inputs not found, treated as empty: ${missing.map((m) => `\`${m}\``).join(', ')}.`, '');

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
md.push(`- Results with no TCID in their title: **${untracedResults}**${untracedResults ? ' — invisible to coverage above' : ''}`);
md.push(`- Results whose TCID is in no plan: **${orphanResults.length}**${orphanResults.length ? ` — ${orphanResults.join(', ')}` : ''}`);
md.push(`- Open defects with no TCID: **${openDefects.filter((d) => !d.tcid).length}**`, '');

const outDir = path.join(ROOT, 'reports');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `cycle-summary-${today}.md`);
fs.writeFileSync(out, md.join('\n'), 'utf8');

console.log(`report:cycle — ${cases.length} test cases, ${count('Passed') + count('Flaky')} passing, ${notExecuted} not executed, ${openDefects.length} open defect(s).`);
console.log(`Exit criteria ${allMet ? 'all met' : 'NOT all met'}: ${criteria.filter((c) => !c.met).map((c) => c.name).join('; ') || 'none failing'}.`);
console.log(`Written to ${path.relative(ROOT, out).split(path.sep).join('/')}`);
process.exit(strict && !allMet ? 1 : 0);
