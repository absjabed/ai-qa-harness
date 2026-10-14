/**
 * `npm run defect:evidence` — keep a defect's screenshots with the defect log, before the next run wipes them.
 *
 * Playwright clears `test-results/` at the start of every run, so the screenshot of a failure is gone by the
 * time anyone files the bug unless it is copied out. For each entry in `specs/defects/defect-log.json` that
 * has a spec file and no evidence yet, this finds the test's failed result in `test-results/results.json`
 * and copies its screenshots and page snapshot (`error-context.md`) into
 * `specs/defects/evidence/<entry id>/`, recording the copied paths in the entry's `attachments`. The healer
 * runs it as soon as you confirm a defect; the defect-raiser attaches those files to the bug.
 *
 *   npm run defect:evidence                       every entry still without evidence
 *   npm run defect:evidence -- PROJ-1234-TC004    entries for this TCID or entry id only
 *   npm run defect:evidence -- --with-traces      also the trace and video — large; they are committed too
 *
 * A defect found by hand has no spec file: put its screenshots in `specs/defects/evidence/<entry id>/`
 * yourself, and the healer lists them in `attachments` when it records the entry.
 */

import fs from 'fs';
import path from 'path';
import { DEFECT_LOG, eachSpec, type PwAttachment, type PwReport } from './lib/cycle';
import { ROOT } from './lib/trace';

interface Entry { id: string; status: string; tcid?: string; specFile?: string | null; testName?: string; attachments?: string[] }

const args = process.argv.slice(2);
const withTraces = args.includes('--with-traces');
const only = args.filter((a) => !a.startsWith('--'));
const abs = (p: string) => path.join(ROOT, p);

if (!fs.existsSync(abs(DEFECT_LOG))) {
    console.log(`defect:evidence — no ${DEFECT_LOG} yet; nothing to do.`);
    process.exit(0);
}
const log = JSON.parse(fs.readFileSync(abs(DEFECT_LOG), 'utf8')) as Entry[];
const results = abs('test-results/results.json');
const report: PwReport | null = fs.existsSync(results) ? JSON.parse(fs.readFileSync(results, 'utf8')) : null;
const specs = report ? eachSpec(report) : [];

const wanted = (a: PwAttachment) =>
    !!a.path && (a.contentType.startsWith('image/') || a.name === 'error-context' || (withTraces && /zip|video/.test(a.contentType)));

let changed = false;
for (const entry of log) {
    if (!entry.specFile || entry.attachments?.length || entry.status === 'verified') continue;
    if (only.length && !only.includes(entry.id) && !only.includes(entry.tcid ?? '')) continue;

    const testFile = path.basename(entry.specFile);
    const spec = specs.find((s) => path.basename(s.file) === testFile && (s.title === entry.testName || (!!entry.tcid && s.title.startsWith(entry.tcid))));
    const failed = spec?.tests.flatMap((t) => t.results ?? []).filter((r) => r.status !== 'passed' && r.status !== 'skipped').pop();
    const files = (failed?.attachments ?? []).filter(wanted).filter((a) => fs.existsSync(a.path!));
    if (!files.length) {
        console.log(`  ${entry.id}: no failed result with files in test-results/ — run its test again (npx playwright test ${entry.specFile} -g ${entry.tcid ?? '"<title>"'}), then this.`);
        continue;
    }

    const dir = path.join('specs/defects/evidence', entry.id);
    fs.mkdirSync(abs(dir), { recursive: true });
    const kept: string[] = [];
    for (const a of files) {
        let name = path.basename(a.path!);
        if (kept.some((k) => path.basename(k) === name)) name = `${kept.length + 1}-${name}`;
        const dest = path.join(dir, name).split(path.sep).join('/');
        fs.copyFileSync(a.path!, abs(dest));
        kept.push(dest);
    }
    entry.attachments = kept;
    changed = true;
    console.log(`  ${entry.id}: kept ${kept.length} file(s) in ${dir.split(path.sep).join('/')}/`);
}

if (changed) fs.writeFileSync(abs(DEFECT_LOG), JSON.stringify(log, null, 2) + '\n', 'utf8');
console.log(changed ? `defect:evidence — ${DEFECT_LOG} updated.` : 'defect:evidence — nothing new to keep.');
