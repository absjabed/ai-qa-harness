/**
 * `npm run defect:evidence` — keep a defect's screenshots with the defect log, before the next run wipes them.
 *
 * Playwright clears `test-results/` at the start of every run, so the screenshot of a failure is gone by the
 * time anyone files the bug unless it is copied out. For each defect in `specs/defects/log/` that
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
import { eachSpec, type PwAttachment, type PwReport } from './lib/cycle';
import { DEFECT_DIR, LEGACY_DEFECT_LOG, readDefects, writeDefect } from './lib/defects';
import { ROOT } from './lib/trace';

const args = process.argv.slice(2);
const withTraces = args.includes('--with-traces');
const only = args.filter((a) => !a.startsWith('--'));
const abs = (p: string) => path.join(ROOT, p);

const { entries: log, legacy } = readDefects();
if (!log.length) {
    console.log(`defect:evidence — no defects in ${DEFECT_DIR}/ yet; nothing to do.`);
    process.exit(0);
}
const results = abs('test-results/results.json');
const report: PwReport | null = fs.existsSync(results) ? JSON.parse(fs.readFileSync(results, 'utf8')) : null;
const specs = report ? eachSpec(report) : [];

const wanted = (a: PwAttachment) =>
    !!a.path && (a.contentType.startsWith('image/') || a.name === 'error-context' || (withTraces && /zip|video/.test(a.contentType)));

const changed = new Set<string>();
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
    changed.add(entry.id);
    console.log(`  ${entry.id}: kept ${kept.length} file(s) in ${dir.split(path.sep).join('/')}/`);
}

// A copy from before 1.1 keeps its defects in one file. Write each out as its own, once, and say so: the old
// file is then left for the team to delete in the same commit.
if (legacy) {
    for (const entry of log) if (!fs.existsSync(abs(`${DEFECT_DIR}/${entry.id}.json`))) changed.add(entry.id);
}
for (const entry of log) if (changed.has(entry.id)) writeDefect(entry);
if (legacy) console.log(`defect:evidence — ${LEGACY_DEFECT_LOG} is the old single log; every entry is now in ${DEFECT_DIR}/. Delete the old file in the same commit.`);
console.log(changed.size ? `defect:evidence — ${changed.size} defect file(s) updated in ${DEFECT_DIR}/.` : 'defect:evidence — nothing new to keep.');
