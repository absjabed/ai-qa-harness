/**
 * The defect log — one JSON file per confirmed defect, in `specs/defects/log/<entry id>.json`.
 *
 * One file each, not one shared array, so two story branches that each record a defect merge without a
 * conflict: they add different files. An entry is never renamed or removed; its `status` moves
 * `pending` → `raised` → `verified`. The healer writes a new file; the defect-raiser and the healer's retest
 * change fields inside it.
 *
 * A copy made before 1.1 may still have the single `specs/defects/defect-log.json`. Its entries are read too,
 * so nothing goes missing from a report; `npm run defect:evidence` writes them back as one file each.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './trace';

export const DEFECT_DIR = 'specs/defects/log';
/** The pre-1.1 single file. Read when present; never written. */
export const LEGACY_DEFECT_LOG = 'specs/defects/defect-log.json';

export interface DefectEntry {
    id: string;
    status: string;
    tcid?: string;
    storyKey?: string;
    severity?: string;
    summary?: string;
    specFile?: string | null;
    testName?: string;
    attachments?: string[];
    trackerKey?: string | null;
    [field: string]: unknown;
}

const abs = (p: string) => path.join(ROOT, p);

/** Where an entry lives: `specs/defects/log/<id>.json`. */
export const defectFile = (id: string) => `${DEFECT_DIR}/${id}.json`;

/** Every defect entry, oldest file name first. `files` lists what was read, for a report's record line. */
export function readDefects(): { entries: DefectEntry[]; files: string[]; legacy: boolean } {
    const byId = new Map<string, DefectEntry>();
    const files: string[] = [];
    let legacy = false;
    if (fs.existsSync(abs(LEGACY_DEFECT_LOG))) {
        legacy = true;
        files.push(LEGACY_DEFECT_LOG);
        for (const e of JSON.parse(fs.readFileSync(abs(LEGACY_DEFECT_LOG), 'utf8')) as DefectEntry[]) byId.set(e.id, e);
    }
    if (fs.existsSync(abs(DEFECT_DIR))) {
        const names = fs.readdirSync(abs(DEFECT_DIR)).filter((f) => f.endsWith('.json')).sort();
        if (names.length) files.push(`${DEFECT_DIR}/`);
        // A file wins over a legacy entry with the same id: it is the newer copy.
        for (const f of names) {
            const entry = JSON.parse(fs.readFileSync(abs(`${DEFECT_DIR}/${f}`), 'utf8')) as DefectEntry;
            byId.set(entry.id, entry);
        }
    }
    return { entries: [...byId.values()], files, legacy };
}

/** Writes one entry to its own file. */
export function writeDefect(entry: DefectEntry): string {
    const file = defectFile(entry.id);
    fs.mkdirSync(abs(DEFECT_DIR), { recursive: true });
    fs.writeFileSync(abs(file), JSON.stringify(entry, null, 2) + '\n', 'utf8');
    return file;
}
