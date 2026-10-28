#!/usr/bin/env node
/**
 * `npm run prep -- <target-dir> [--name "<Project name>"]` — make the folder a project's QA repo will grow in,
 * ready for the team to prepare before setup day.
 *
 * It writes `setup/` — a start-here page, a filling guide, a checklist, and one file per thing to gather
 * (accounts and roles, Jira, decisions, contacts, local paths) — and the `context/sources/` subfolders the
 * project's documents go in. Nothing in it is a password or a harness file, so on setup day `npm run export`
 * goes into the same folder without moving anything.
 *
 * Templates live in `prep/setup/`, with `{{PROJECT}}` (the project's display name), `{{FOLDER}}` (the folder's
 * name) and `{{SLUG}}` (the name in lowercase) filled in here. It never overwrites: if a file it would write
 * already exists, it lists them and writes nothing.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const TEMPLATES = path.join(root, 'prep', 'setup');
const SOURCE_FOLDERS = ['specs', 'test-cases', 'defects', 'jira', 'guides'];

function fail(message) {
    console.error(`\nprep: ${message}\n`);
    process.exit(1);
}

const args = process.argv.slice(2);
const nameIdx = args.indexOf('--name');
const targetArg = args.find((a, i) => !a.startsWith('--') && (nameIdx < 0 || i !== nameIdx + 1));
if (!targetArg) {
    fail('usage: npm run prep -- <target-dir> [--name "<Project name>"]\n\n' +
        '  <target-dir> is the folder the project\'s QA repo will be, e.g. ../acme-qa');
}

const target = path.resolve(targetArg);
const rel = path.relative(root, target);
if (!rel.startsWith('..') && !path.isAbsolute(rel)) fail(`${target} is inside the template. Prepare a folder outside it.`);

const folder = path.basename(target);
// "acme-portal-qa" → "Acme Portal", unless --name says otherwise.
const derived = folder.replace(/[-_]?qa$/i, '').split(/[-_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || folder;
const project = (nameIdx >= 0 && args[nameIdx + 1]) || derived;
const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';

const templates = fs.readdirSync(TEMPLATES).filter((f) => f.endsWith('.md'));
const writes = [
    ...templates.map((f) => ({ to: path.join('setup', f), from: path.join(TEMPLATES, f) })),
    ...SOURCE_FOLDERS.map((d) => ({ to: path.join('context', 'sources', d, '.gitkeep'), from: null })),
];

const conflicts = writes.filter((w) => fs.existsSync(path.join(target, w.to)));
if (conflicts.length) {
    fail(`${conflicts.length} file(s) already exist in ${target} — nothing was written:\n\n` +
        conflicts.map((w) => `  ${w.to}`).join('\n') +
        '\n\nThis never overwrites, so a prepared folder is never clobbered. Move them, or prepare a new folder.');
}

for (const w of writes) {
    const dest = path.join(target, w.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const text = w.from
        ? fs.readFileSync(w.from, 'utf8').replace(/\r\n/g, '\n')
            .replace(/\{\{PROJECT\}\}/g, project).replace(/\{\{FOLDER\}\}/g, folder).replace(/\{\{SLUG\}\}/g, slug)
        : '';
    fs.writeFileSync(dest, text);
}

console.log(`
prep: ${target} is ready for ${project}
  setup/            ${templates.join(', ')}
  context/sources/  ${SOURCE_FOLDERS.join('/, ')}/

Next: the team opens setup/START-HERE.md, fills in setup/ (setup/FILLING-GUIDE.md has the detail) and
drops the project's documents into context/sources/. On setup day, from this template:

  npm run export -- ${targetArg}

The export copies the harness into the same folder and leaves setup/ and context/sources/ as they are.
`);
