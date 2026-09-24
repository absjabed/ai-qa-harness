/**
 * `npm run check:trace` — enforce I8, traceability.
 *
 * The chain runs acceptance criterion → test case → automated test → result → defect, and each link is
 * held by an ID that appears on both sides. This checks the links that can be checked without running
 * anything: that plans and tests agree on which TCIDs exist, and that no test has lost its TCID.
 *
 * Passes trivially on a fresh template — there are no plans or story specs yet.
 */

import { projectProfile } from '../config/projectProfile';
import {
    allSpecFiles, parsePlan, parseTests, planFiles, rel, REFERENCE_SPECS, storyKeyOf, storySpecFiles, TCID,
} from './lib/trace';

const errors: string[] = [];
const warnings: string[] = [];
const keyPattern = projectProfile.storyKeyPattern;

// ---------------------------------------------------------------- plans

const plans = new Map(planFiles().map((f) => [storyKeyOf(f, '.plan.md'), parsePlan(f)]));
const planned = new Map<string, { retired: boolean }>();

for (const plan of plans.values()) {
    if (!keyPattern.test(plan.storyKey)) {
        errors.push(`${plan.file}: story key "${plan.storyKey}" does not match ${keyPattern} (PROJECT-PROFILE.md section 1)`);
    }
    plan.problems.forEach((p) => errors.push(`${plan.file}: ${p}`));
    if (plan.cases.length === 0) warnings.push(`${plan.file}: no TC-numbered scenarios found`);
    for (const c of plan.cases) planned.set(c.tcid, { retired: c.retired });

    for (const [ac, ids] of plan.acceptanceCriteria) {
        if (ids.length === 0) warnings.push(`${plan.file}: ${ac} has no test case linked to it`);
        for (const id of ids) {
            if (!plan.cases.some((c) => c.tcid === id)) {
                errors.push(`${plan.file}: traceability table links ${ac} to ${id}, which is not a scenario in this plan`);
            }
        }
    }
}

// ---------------------------------------------------------------- story specs

for (const file of storySpecFiles()) {
    const key = storyKeyOf(file, '.spec.ts');
    const where = rel(file);
    if (!keyPattern.test(key)) {
        errors.push(`${where}: file must be named for its story key; "${key}" does not match ${keyPattern}`);
    }
    if (!plans.has(key)) {
        errors.push(`${where}: no plan at specs/${key}.plan.md — every story's tests need the plan that assigns their TCIDs`);
    }
    for (const t of parseTests(file)) {
        if (!t.tcid) {
            errors.push(`${where}:${t.line}: test "${t.title}" has no TCID — titles start with ${key}-TC<NNN>`);
            continue;
        }
        const owner = t.tcid.match(TCID)?.[1];
        if (owner !== key) {
            errors.push(`${where}:${t.line}: ${t.tcid} belongs to ${owner}, but this file holds story ${key}`);
        }
    }
}

// ---------------------------------------------------------------- every TCID'd test, anywhere

const seenTcid = new Map<string, string>();
let untraced = 0;

for (const file of allSpecFiles()) {
    if (REFERENCE_SPECS.has(rel(file))) continue;
    for (const t of parseTests(file)) {
        const at = `${t.file}:${t.line}`;
        if (!t.tcid) {
            if (!t.file.startsWith('tests/stories/')) untraced++;
            continue;
        }
        if (seenTcid.has(t.tcid)) errors.push(`${at}: ${t.tcid} is already used by ${seenTcid.get(t.tcid)} — one test per TCID`);
        else seenTcid.set(t.tcid, at);

        const entry = planned.get(t.tcid);
        if (!entry) errors.push(`${at}: ${t.tcid} is not a scenario in any plan — TCIDs are assigned only in plans`);
        else if (entry.retired) errors.push(`${at}: ${t.tcid} is marked Retired in its plan, but still has a test`);

        if (t.disabled === 'fixme' && !/\/\/\s*Defect\b/.test(t.lineAbove)) {
            warnings.push(`${at}: ${t.tcid} is test.fixme with no "// Defect …" comment above it — say why it is skipped`);
        }
    }
}

if (untraced > 0) {
    warnings.push(`${untraced} test(s) outside tests/stories/ carry no TCID — allowed, but invisible to AC coverage in report:cycle`);
}

// ---------------------------------------------------------------- report

warnings.forEach((w) => console.warn(`warning: ${w}`));

if (errors.length === 0) {
    console.log(`check:trace passed — ${plans.size} plan(s), ${planned.size} test case(s), ${seenTcid.size} traced test(s).`);
    process.exit(0);
}

console.error(`\ncheck:trace found ${errors.length} problem(s):\n`);
errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
console.error('');
process.exit(1);
