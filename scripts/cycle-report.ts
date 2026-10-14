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
 *   npm run report:cycle -- --strict                        exit non-zero if an exit criterion is unmet
 *
 * See scripts/lib/cycle.ts for what goes into it.
 */

import 'dotenv/config';
import { buildCycleReport } from './lib/cycle';

const args = process.argv.slice(2);
const values = (flag: string) =>
    args.flatMap((a, i) => (a === flag && args[i + 1] ? args[i + 1].split(',') : [])).map((s) => s.trim()).filter(Boolean);

const result = buildCycleReport({
    releases: values('--release'),
    stories: values('--stories'),
    trigger: 'run by hand',
});

console.log(`report:cycle — ${result.summary}.`);
if (result.file) console.log(`Written to ${result.file}`);
process.exit(args.includes('--strict') && !result.allMet ? 1 : 0);
