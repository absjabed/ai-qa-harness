/**
 * `npm run context:sync` — what a test run can tell `context/` — suggestions only, never written here.
 *
 * For the stories in scope (the last run's by default, or `--stories`), it links each test case to the rules in
 * `context/<area>.md` it exercises, and to the known unknowns it may answer, by the references they share:
 * the rule and document IDs its acceptance criteria and scenario cite (`BR-019`), and its story key.
 *
 *   - verified    — a case that passed exercises a rule: suggest recording `verified: <TCID>, <date>` on it.
 *   - contradicted — a case that failed exercises a rule and a defect is recorded: the rule stays a rule, and a
 *                    caveat can name the open defect. A result never rewrites or adds a rule. The rule's passing
 *                    cases are held here, not listed as verified, until the defect is fixed.
 *   - untriaged   — a case that failed, with no defect recorded yet: nothing to suggest until it is triaged.
 *   - unknowns    — a known unknown (`context/BASELINE.md` section 8, or an area's Caveats) shares a reference
 *                    with a case that passed: a person decides whether the case answered it.
 *
 * The executor shows these at close-out; on a yes the context-builder applies them as a scoped update. Every
 * match is read from the files; nothing is estimated.
 *
 *   npm run context:sync                          # the stories of the last run
 *   npm run context:sync -- --stories FK-1304     # chosen stories, from their latest recorded results
 *   npm run context:sync -- --text                # a short summary instead of JSON
 */

import fs from 'fs';
import path from 'path';
import { AUTOMATED_RECORD, MANUAL_RECORD, RECORD_HEADER, eachSpec, readRecord, type PwReport } from './lib/cycle';
import { readDefects } from './lib/defects';
import { parsePlan, planFiles, ROOT, TCID_PREFIX } from './lib/trace';

const LATEST_RUN = path.join(ROOT, 'test-results', 'results.json');
const CONTEXT_DIR = path.join(ROOT, 'context');
const NOT_AREAS = new Set(['README.md', '_TEMPLATE.md', 'BASELINE.md']);
/** A reference two documents can share: an issue key, a business-rule or requirement ID — `FK-1304`, `BR-019`. */
const REF = /\b[A-Z][A-Z0-9]*-\d+\b/g;

const refsIn = (text: string): string[] => [...new Set(text.match(REF) ?? [])];
const oneLine = (text: string, max = 140) => {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

interface Case {
    tcid: string;
    storyKey: string;
    planFile: string;
    /** References the case carries: its story key, and the IDs its acceptance criteria and its scenario cite. */
    refs: string[];
    outcome: string;
    executedOn: string;
}

interface Rule { doc: string; n: number; text: string; refs: string[]; verified: { tcid: string; date: string }[] }
interface Unknown { doc: string; section: string; text: string; refs: string[] }

function arg(name: string): string | null {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] ?? null : null;
}

/** The stories the last run touched, from the TCIDs in its test titles. */
function lastRunStories(): string[] {
    if (!fs.existsSync(LATEST_RUN)) return [];
    const report = JSON.parse(fs.readFileSync(LATEST_RUN, 'utf8')) as PwReport;
    const stories = new Set<string>();
    for (const spec of eachSpec(report)) {
        const tcid = spec.title.match(TCID_PREFIX)?.[1];
        if (tcid) stories.add(tcid.replace(/-TC\d{3}$/, ''));
    }
    return [...stories].sort();
}

/** Each case of the stories, with what it references and its latest result, automated or manual. */
function casesOf(stories: Set<string>): Case[] {
    const automated = readRecord(AUTOMATED_RECORD, RECORD_HEADER);
    const manual = readRecord(MANUAL_RECORD, ['TCID', 'Status', 'Executed On']);
    const out: Case[] = [];
    for (const file of planFiles()) {
        const plan = parsePlan(file);
        if (!stories.has(plan.storyKey)) continue;
        const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

        // `- **AC2** — A vehicle cannot return to service while … (BR-019).` → AC2 → [BR-019]
        const acRefs = new Map<string, string[]>();
        for (const m of text.matchAll(/^\s*[-*]\s*\*\*(AC\d+)\*\*\s*[—–:-]\s*(.+)$/gim)) {
            acRefs.set(m[1].toUpperCase(), refsIn(m[2]));
        }
        // The scenario's own body, up to the next heading, for IDs it cites directly.
        const bodyOf = (tcid: string): string => {
            const start = text.search(new RegExp(`^###\\s+\`?${tcid}\\b`, 'm'));
            if (start < 0) return '';
            const rest = text.slice(start + 3);
            const end = rest.search(/^#{1,3}\s/m);
            return end < 0 ? rest : rest.slice(0, end);
        };

        for (const c of plan.cases) {
            if (c.retired) continue;
            const refs = new Set<string>([plan.storyKey, ...refsIn(bodyOf(c.tcid))]);
            for (const [ac, tcids] of plan.acceptanceCriteria) {
                if (tcids.includes(c.tcid)) for (const r of acRefs.get(ac) ?? []) refs.add(r);
            }
            const row = (c.testType === 'Manual' ? manual : automated).get(c.tcid);
            out.push({
                tcid: c.tcid,
                storyKey: plan.storyKey,
                planFile: plan.file,
                refs: [...refs],
                outcome: row?.Status || 'Not Run',
                executedOn: row?.['Executed On'] ?? '',
            });
        }
    }
    return out;
}

/** The numbered rules under `## Invariants` in each area document, with any `verified:` already recorded. */
function readRules(): { rules: Rule[]; unknowns: Unknown[]; docs: string[] } {
    const rules: Rule[] = [];
    const unknowns: Unknown[] = [];
    const docs = fs.existsSync(CONTEXT_DIR)
        ? fs.readdirSync(CONTEXT_DIR).filter((f) => f.endsWith('.md') && !NOT_AREAS.has(f)).sort()
        : [];
    const bullets = (section: string) =>
        section.split('\n').filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
            .filter((l) => l && !l.startsWith('`<'));

    for (const doc of docs) {
        const text = fs.readFileSync(path.join(CONTEXT_DIR, doc), 'utf8').replace(/\r\n/g, '\n');
        const sections = text.split(/^## /m);
        const invariants = sections.find((s) => /^Invariants\b/.test(s)) ?? '';
        for (const chunk of invariants.split(/^(?=\d+\.\s)/m).filter((r) => /^\d+\.\s/.test(r))) {
            const n = Number(chunk.match(/^(\d+)\./)![1]);
            const body = chunk.trim();
            if (/^\d+\.\s+`?</.test(body)) continue; // template placeholder
            const verified = [...body.matchAll(/verified:\s*([A-Z][A-Z0-9]*-\d+-TC\d{3}),?\s*(\d{4}-\d{2}-\d{2})/g)]
                .map(([, tcid, date]) => ({ tcid, date }));
            // A recorded `verified: FK-1304-TC001, …` names a story; it must not link the rule to every case of it.
            const cited = body.replace(/verified:\s*[^·\n]*/g, '');
            rules.push({ doc: `context/${doc}`, n, text: body.replace(/^\d+\.\s+/, ''), refs: refsIn(cited), verified });
        }
        const caveats = sections.find((s) => /^Caveats\b/.test(s));
        for (const b of caveats ? bullets(caveats) : []) {
            unknowns.push({ doc: `context/${doc}`, section: 'Caveats', text: b, refs: refsIn(b) });
        }
    }
    const baseline = path.join(CONTEXT_DIR, 'BASELINE.md');
    if (fs.existsSync(baseline)) {
        const section = fs.readFileSync(baseline, 'utf8').replace(/\r\n/g, '\n').split(/^## /m)
            .find((s) => /^\d+\.\s+Known unknowns\b/.test(s));
        for (const b of section ? bullets(section) : []) {
            unknowns.push({ doc: 'context/BASELINE.md', section: 'Known unknowns', text: b, refs: refsIn(b) });
        }
    }
    return { rules, unknowns, docs: docs.map((d) => `context/${d}`) };
}

function main(): void {
    const given = arg('--stories');
    const stories = given ? given.split(',').map((s) => s.trim()).filter(Boolean) : lastRunStories();
    const from = given ? '--stories' : 'the last run';
    if (!stories.length) {
        console.log(JSON.stringify({ found: false, reason: given ? 'no stories given' : 'no test-results/results.json with TCIDs — run the tests, or pass --stories' }, null, 2));
        return;
    }

    const cases = casesOf(new Set(stories));
    const { rules, unknowns, docs } = readRules();
    const openDefects = readDefects().entries.filter((d) => d.status !== 'verified' && d.tcid);

    /**
     * One suggestion per rule or unknown and kind, listing every case behind it. A rule may cite the story key
     * as its source, so the key links a rule; an unknown is a specific question, so only a cited rule or
     * document ID links one — otherwise every case of the story would "answer" every unknown naming it.
     */
    interface Suggestion {
        doc: string; rule?: number; ruleText?: string; section?: string; unknown?: string;
        tcids: string[]; via: string[]; lastRun: string; defects?: string[]; held?: string[]; suggest: string;
    }
    const groups = { verified: new Map<string, Suggestion>(), contradicted: new Map<string, Suggestion>(), untriaged: new Map<string, Suggestion>(), unknowns: new Map<string, Suggestion>() };
    const add = (kind: keyof typeof groups, key: string, c: Case, via: string[], base: Omit<Suggestion, 'tcids' | 'via' | 'lastRun'>) => {
        const g = groups[kind].get(key) ?? { ...base, tcids: [], via: [], lastRun: '' };
        if (!g.tcids.includes(c.tcid)) g.tcids.push(c.tcid);
        for (const v of via) if (!g.via.includes(v)) g.via.push(v);
        if (c.executedOn > g.lastRun) g.lastRun = c.executedOn;
        groups[kind].set(key, g);
    };
    const touched = new Set<string>();

    for (const c of cases) {
        const day = c.executedOn.slice(0, 10);
        for (const rule of rules) {
            const via = c.refs.filter((r) => rule.refs.includes(r));
            if (!via.length) continue;
            const base = { doc: rule.doc, rule: rule.n, ruleText: oneLine(rule.text) };
            const key = `${rule.doc}#${rule.n}`;
            if (c.outcome === 'Passed') {
                touched.add(rule.doc);
                if (rule.verified.some((v) => v.tcid === c.tcid && v.date >= day)) continue; // already recorded
                add('verified', key, c, via, { ...base, suggest: 'record "verified: <TCID>, <date>" on the rule for each case' });
            } else if (c.outcome === 'Failed') {
                touched.add(rule.doc);
                const defects = openDefects.filter((d) => d.tcid === c.tcid).map((d) => d.trackerKey || d.id);
                const earlier = rule.verified.find((v) => v.tcid === c.tcid);
                const stale = earlier ? `; its "verified: ${earlier.tcid}, ${earlier.date}" is now out of date` : '';
                if (defects.length) {
                    add('contradicted', key, c, via, { ...base, suggest: `keep the rule — the app is wrong, not the rule; a caveat can name the open defect${stale}` });
                    const g = groups.contradicted.get(key)!;
                    g.defects = [...new Set([...(g.defects ?? []), ...defects])];
                } else {
                    add('untriaged', key, c, via, { ...base, suggest: `triage the failure first (the healer); nothing to suggest yet${stale}` });
                }
            }
        }
        if (c.outcome !== 'Passed') continue;
        for (const u of unknowns) {
            const via = c.refs.filter((r) => r !== c.storyKey && u.refs.includes(r));
            if (via.length) add('unknowns', `${u.doc}|${u.text}`, c, via, { doc: u.doc, section: u.section, unknown: oneLine(u.text), suggest: 'a person decides whether these cases answered it' });
        }
    }

    // A rule with an open contradiction takes no new `verified:` marks: its passing cases are held on the
    // contradiction, to be recorded once the defect is fixed and retested — never listed as "record it".
    for (const [key, held] of groups.verified) {
        const c = groups.contradicted.get(key);
        if (!c) continue;
        c.held = held.tcids;
        c.suggest += `; hold ${held.tcids.join(', ')} — no new "verified:" marks while the defect is open; record them once it is verified`;
        groups.verified.delete(key);
    }

    const list = (m: Map<string, Suggestion>) => [...m.values()];
    const result = {
        found: true,
        scope: { stories, from },
        cases: cases.map(({ tcid, outcome, executedOn, refs }) => ({ tcid, outcome, executedOn, refs })),
        contextDocs: docs,
        areasTouched: [...touched].sort(),
        verified: list(groups.verified),
        contradicted: list(groups.contradicted),
        untriaged: list(groups.untriaged),
        unknowns: list(groups.unknowns),
        note: 'Suggestions only. Applied by the context-builder on a yes. A test result never becomes a new rule.',
    };

    if (!process.argv.includes('--text')) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    console.log(`Context sync for ${stories.join(', ')} (${from}) — ${plural(cases.length, 'case')}, ${plural(docs.length, 'context document')}`);
    if (!docs.length) console.log('  No context/<area>.md documents yet — nothing to link to.');
    const sections: [string, Suggestion[]][] = [
        ['Verified — record it', result.verified],
        ['Contradicted — rule kept', result.contradicted],
        ['Failed, not triaged', result.untriaged],
        ['Known unknowns these cases may answer', result.unknowns],
    ];
    for (const [title, items] of sections) {
        if (!items.length) continue;
        console.log(`${title}:`);
        for (const s of items) {
            const what = s.rule ? `${s.doc} rule ${s.rule} — ${s.ruleText}` : `${s.doc} (${s.section}) — ${s.unknown}`;
            const defects = s.defects ? `; open defect ${s.defects.join(', ')}` : '';
            console.log(`  ${what}\n    ← ${s.tcids.join(', ')} via ${s.via.join(', ')}, last run ${s.lastRun || 'not recorded'}${defects}: ${s.suggest}`);
        }
    }
    if (sections.every(([, items]) => !items.length)) {
        console.log(touched.size
            ? '  Every link is already recorded — nothing new to suggest.'
            : '  No case shares a reference with a context rule or a known unknown — nothing to suggest.');
    }
}

main();
