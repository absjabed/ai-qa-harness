/**
 * `npm run report:cycle` — the test-cycle closure report, by hand.
 *
 * The same report is also written automatically after every test run (lib/cycleReporter.ts) and at the end
 * of `npm run regression`. Use this to rebuild it — after recording manual results, say — or for a
 * different scope than the last run covered.
 *
 *   npm run report:cycle                                    every story with a plan
 *   npm run report:cycle -- --release 2.26                  stories in one client release (repeatable)
 *   npm run report:cycle -- --stories PROJ-12,PROJ-15       chosen stories
 *   npm run report:cycle -- --since 2026-10-01              ignore results from before this cycle began
 *   npm run report:cycle -- --closure                       the final report: written to specs/execution/closure/, committed
 *   npm run report:cycle -- --strict                        exit non-zero if an exit criterion is unmet
 *
 * See scripts/lib/cycle.ts for what goes into it.
 */

import 'dotenv/config';
import { buildCycleReport } from './lib/cycle';

const args = process.argv.slice(2);
const values = (flag: string) =>
    args.flatMap((a, i) => (a === flag && args[i + 1] ? args[i + 1].split(',') : [])).map((s) => s.trim()).filter(Boolean);

const since = values('--since')[0];
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error(`report:cycle — --since takes a date as YYYY-MM-DD, not "${since}".`);
    process.exit(1);
}

const result = buildCycleReport({
    releases: values('--release'),
    stories: values('--stories'),
    since,
    closure: args.includes('--closure'),
    trigger: args.includes('--closure') ? 'closure report, run by hand' : 'run by hand',
});

console.log(`report:cycle — ${result.summary}.`);
if (result.file) console.log(`Written to ${result.file}`);
process.exit(args.includes('--strict') && !result.allMet ? 1 : 0);
