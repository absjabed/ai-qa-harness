/**
 * Shared traceability parsing for `check:trace` and `report:cycle`.
 *
 * One parser, so the check that enforces TCIDs and the report that counts them can never disagree about
 * what a TCID is or where one lives. See I8 in TEST-AUTHORING-INVARIANTS.md.
 */

import fs from 'fs';
import path from 'path';

export const ROOT = path.join(__dirname, '..', '..');

/** `PROJ-1234-TC004` → story `PROJ-1234`, number `004`. */
export const TCID = /^([A-Z][A-Z0-9]*-\d+)-TC(\d{3})$/;
/** A title that begins with something shaped like a TCID. */
export const TCID_PREFIX = /^([A-Z][A-Z0-9]*-\d+-TC\d{3})\b/;

export type TestType = 'Automated' | 'Manual' | 'Unknown';

export interface PlannedCase {
    tcid: string;
    storyKey: string;
    summary: string;
    testType: TestType;
    priority: 1 | 2 | 3 | null;
    retired: boolean;
    planFile: string;
}

export interface Plan {
    storyKey: string;
    file: string;
    cases: PlannedCase[];
    /** AC label (e.g. `AC1`) → TCIDs linked to it in the plan's traceability table. */
    acceptanceCriteria: Map<string, string[]>;
    /** Problems found while parsing — malformed or mismatched TCIDs, duplicates. */
    problems: string[];
}

export interface DeclaredTest {
    title: string;
    tcid: string | null;
    file: string;
    line: number;
    /** `test.fixme(...)` or `test.skip(...)` at the declaration. */
    disabled: 'fixme' | 'skip' | null;
    /** The source line directly above the declaration, for defect comments. */
    lineAbove: string;
}

export const rel = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/');

export function walk(dir: string, match: (file: string) => boolean): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            out.push(...walk(full, match));
        } else if (match(full)) {
            out.push(full);
        }
    }
    return out;
}

/** Plans live at `specs/<STORY-KEY>.plan.md` — top level only; templates and reference docs are elsewhere. */
export function planFiles(): string[] {
    const dir = path.join(ROOT, 'specs');
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.plan.md'))
        .map((f) => path.join(dir, f));
}

export function storyKeyOf(file: string, suffix: string): string {
    return path.basename(file).slice(0, -suffix.length);
}

function parsePriority(text: string): 1 | 2 | 3 | null {
    const m = text.match(/Priority\s*([123])/i);
    return m ? (Number(m[1]) as 1 | 2 | 3) : null;
}

function parseTestType(text: string): TestType {
    if (/\bManual\b/i.test(text)) return 'Manual';
    if (/\bAutomated\b/i.test(text)) return 'Automated';
    return 'Unknown';
}

export function parsePlan(file: string): Plan {
    const storyKey = storyKeyOf(file, '.plan.md');
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const plan: Plan = { storyKey, file: rel(file), cases: [], acceptanceCriteria: new Map(), problems: [] };
    const seen = new Set<string>();

    // Scenario headings: `### PROJ-1234-TC004 — Validate that ...` (backticks tolerated, any dash).
    for (let i = 0; i < lines.length; i++) {
        const heading = lines[i].replace(/`/g, '').match(/^###\s+(\S+)\s+[—–-]\s+(.+?)\s*$/);
        if (!heading || !/-TC\d/.test(heading[1])) continue;

        const [, id, summary] = heading;
        const m = id.match(TCID);
        if (!m) {
            plan.problems.push(`malformed TCID "${id}" — expected ${storyKey}-TC<NNN>`);
            continue;
        }
        if (m[1] !== storyKey) {
            plan.problems.push(`${id} belongs to story ${m[1]}, but this is the plan for ${storyKey}`);
        }
        if (seen.has(id)) plan.problems.push(`${id} is used by more than one scenario`);
        seen.add(id);

        // Fields run until the next heading.
        let j = i + 1;
        const body: string[] = [];
        while (j < lines.length && !/^#{1,3}\s/.test(lines[j])) body.push(lines[j++]);
        const field = (name: string) => body.find((l) => l.startsWith(`**${name}:**`)) ?? '';

        plan.cases.push({
            tcid: id,
            storyKey,
            summary,
            testType: parseTestType(field('Test Type')),
            priority: parsePriority(field('Priority')),
            retired: /Retired/i.test(field('Status')),
            planFile: rel(file),
        });
    }

    // Traceability table rows: `| AC1 | TC001, TC004 |` — short or full TCIDs.
    for (const line of lines) {
        const row = line.match(/^\|\s*(AC\d+)\s*\|\s*([^|]*)\|/i);
        if (!row) continue;
        const ids = [...row[2].matchAll(/(?:([A-Z][A-Z0-9]*-\d+)-)?TC(\d{3})/g)].map(
            ([, key, n]) => `${key ?? storyKey}-TC${n}`
        );
        plan.acceptanceCriteria.set(row[1].toUpperCase(), ids);
    }

    return plan;
}

/** Test declarations — `test(`, `test.fixme(`, `test.skip(`… with a string-literal title. */
const DECLARATION = /\btest(?:\.(only|fixme|skip|fail|slow))?\(\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/g;

export function parseTests(file: string): DeclaredTest[] {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const out: DeclaredTest[] = [];
    for (const m of text.matchAll(DECLARATION)) {
        const title = m[3];
        const line = text.slice(0, m.index).split('\n').length;
        const modifier = m[1];
        out.push({
            title,
            tcid: title.match(TCID_PREFIX)?.[1] ?? null,
            file: rel(file),
            line,
            disabled: modifier === 'fixme' || modifier === 'skip' ? modifier : null,
            lineAbove: (lines[line - 2] ?? '').trim(),
        });
    }
    return out;
}

/** Story-wise specs: `tests/stories/<release>/<STORY-KEY>.spec.ts`. */
export function storySpecFiles(): string[] {
    return walk(path.join(ROOT, 'tests', 'stories'), (f) => f.endsWith('.spec.ts'));
}

/** Every spec in the suite, story-wise or not. */
export function allSpecFiles(): string[] {
    return walk(path.join(ROOT, 'tests'), (f) => f.endsWith('.spec.ts'));
}

/** Reference and scaffold specs that exist to teach, not to test a requirement. */
export const REFERENCE_SPECS = new Set(['tests/example.spec.ts', 'tests/seed.spec.ts']);
