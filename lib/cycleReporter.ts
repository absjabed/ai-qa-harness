import type { FullResult, Reporter, TestCase } from '@playwright/test/reporter';
import { buildCycleReport, recordAutomatedResults, type CycleScope } from '../scripts/lib/cycle';
import { TCID_PREFIX } from '../scripts/lib/trace';

/**
 * Records every run's results, then writes the test-cycle closure report — no separate step to remember.
 *
 * First, each test case that ran gets its latest result in `specs/execution/automated-results.csv`, so a
 * cycle made of several runs — the regression, the healer's re-runs, a retest — is reported as a whole.
 * That always happens.
 *
 * Scoped to the stories that actually ran: run one ticket's spec and the report covers that ticket, not
 * every plan in the repository with everything else marked "Not Run". `npm run regression` passes its own
 * scope — the release and tickets you selected — through `CYCLE_REPORT_SCOPE`.
 *
 * Listed after the JSON reporter in playwright.config.ts: Playwright finishes reporters in order, so
 * `test-results/results.json` is complete by the time this reads it. Set `AUTO_CYCLE_REPORT=false` to
 * turn it off; `npm run report:cycle` rebuilds the report by hand either way.
 */
export default class CycleReporter implements Reporter {
    private stories = new Set<string>();

    printsToStdio(): boolean {
        return false;
    }

    onTestEnd(test: TestCase): void {
        const tcid = test.title.match(TCID_PREFIX)?.[1];
        if (tcid) this.stories.add(tcid.replace(/-TC\d{3}$/, ''));
    }

    onEnd(_result: FullResult): void {
        try {
            const { recorded, file } = recordAutomatedResults();
            if (recorded) console.log(`\nResults of ${recorded} test case(s) recorded in ${file}.`);
        } catch (error) {
            console.log(`\nResults could not be recorded: ${(error as Error).message}`);
        }

        if (process.env.AUTO_CYCLE_REPORT === 'false') return;

        let scope: CycleScope;
        try {
            scope = process.env.CYCLE_REPORT_SCOPE
                ? (JSON.parse(process.env.CYCLE_REPORT_SCOPE) as CycleScope)
                : { stories: [...this.stories] };
        } catch {
            console.log('\nCycle report skipped: CYCLE_REPORT_SCOPE is not valid JSON.');
            return;
        }
        if (!scope.stories?.length && !scope.releases?.length) return; // nothing traced ran — nothing to report

        try {
            const result = buildCycleReport({ ...scope, trigger: `written automatically after the run${scope.trigger ? ` — ${scope.trigger}` : ''}` });
            console.log(`\nCycle report — ${result.summary}.${result.file ? `\n  ${result.file}` : ''}`);
        } catch (error) {
            // A report failure must never turn a finished run red.
            console.log(`\nCycle report could not be written: ${(error as Error).message}`);
        }
    }
}
