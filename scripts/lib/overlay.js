/**
 * Example layers — `examples/<name>/<layer>/overlay.json` — applied on top of an exported copy.
 *
 * A layer never carries a copy of a harness file. It carries the *changes* a project made to one — exact
 * replacements, appended text, settings in `.env.example` — plus the project's own new files. So when the
 * template improves a harness file, an example built on it keeps the improvement instead of reverting it,
 * and `npm run check:docs` fails the moment a template change stops a replacement from applying.
 *
 * overlay.json:
 *   copy      [{ from, to, replace: [[old, new]] }]   a new file made from an existing one (a login file per role)
 *   edit      [{ file, replace: [[old, new]] }]       each `old` must occur exactly once
 *   append    [{ file, text }]
 *   files     [path]                                   new files, from files/<path> — must not exist yet
 *   replaces  [path]                                   files/<path> replaces a placeholder file the template ships
 *   delete    [path]
 *   env       { set: {KEY: value}, remove: [KEY], add_heading, add: {KEY: value} }   applied to .env.example
 */

const fs = require('fs');
const path = require('path');

const BINARY = /\.(png|jpe?g|gif|webm|zip|pdf)$/i;
const readText = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const count = (text, s) => text.split(s).length - 1;

function loadLayer(layerDir) {
    return JSON.parse(fs.readFileSync(path.join(layerDir, 'overlay.json'), 'utf8'));
}

/** Problems that would stop `layerDir` applying to a copy of `base` (the template root). Empty when it applies. */
function checkLayer(layerDir, base) {
    const layer = loadLayer(layerDir);
    const problems = [];
    const has = (f) => fs.existsSync(path.join(base, f));
    const once = (file, old, what) => {
        if (!has(file)) return problems.push(`${what}: ${file} does not exist in the template`);
        const n = count(readText(path.join(base, file)), old);
        if (n !== 1) problems.push(`${what}: ${file} — "${old.split('\n')[0].slice(0, 70)}" occurs ${n} times, expected once`);
    };
    for (const c of layer.copy ?? []) for (const [old] of c.replace ?? []) once(c.from, old, `copy to ${c.to}`);
    for (const e of layer.edit ?? []) for (const [old] of e.replace) once(e.file, old, 'edit');
    for (const a of layer.append ?? []) if (!has(a.file)) problems.push(`append: ${a.file} does not exist in the template`);
    for (const f of layer.files ?? []) {
        if (!fs.existsSync(path.join(layerDir, 'files', f))) problems.push(`files: files/${f} is missing from the layer`);
        if (has(f)) problems.push(`files: ${f} already exists in the template — list it under "replaces", or make the change an edit`);
    }
    for (const f of layer.replaces ?? []) {
        if (!fs.existsSync(path.join(layerDir, 'files', f))) problems.push(`replaces: files/${f} is missing from the layer`);
        if (!has(f)) problems.push(`replaces: ${f} does not exist in the template`);
    }
    for (const f of layer.delete ?? []) if (!has(f)) problems.push(`delete: ${f} does not exist in the template`);
    if (layer.env) {
        const env = readText(path.join(base, '.env.example'));
        for (const k of [...Object.keys(layer.env.set ?? {}), ...(layer.env.remove ?? [])]) {
            if (!new RegExp(`^${k}=`, 'm').test(env)) problems.push(`env: ${k} is not in the template's .env.example`);
        }
    }
    return problems;
}

/** Apply `layerDir` to the copy at `target`. Throws on the first change that does not apply. */
function applyLayer(layerDir, target) {
    const layer = loadLayer(layerDir);
    const at = (f) => path.join(target, f);
    const write = (f, text) => { fs.mkdirSync(path.dirname(at(f)), { recursive: true }); fs.writeFileSync(at(f), text); };
    const replaceOnce = (file, text, [old, neu]) => {
        if (count(text, old) !== 1) throw new Error(`${file}: "${old.split('\n')[0].slice(0, 70)}" does not occur exactly once`);
        return text.replace(old, () => neu);
    };

    for (const c of layer.copy ?? []) write(c.to, (c.replace ?? []).reduce((t, r) => replaceOnce(c.from, t, r), readText(at(c.from))));
    for (const e of layer.edit ?? []) write(e.file, e.replace.reduce((t, r) => replaceOnce(e.file, t, r), readText(at(e.file))));
    for (const a of layer.append ?? []) write(a.file, readText(at(a.file)) + a.text);
    for (const f of [...(layer.files ?? []), ...(layer.replaces ?? [])]) {
        const src = path.join(layerDir, 'files', f);
        fs.mkdirSync(path.dirname(at(f)), { recursive: true });
        if (BINARY.test(f)) fs.copyFileSync(src, at(f));
        else fs.writeFileSync(at(f), readText(src));
    }
    for (const f of layer.delete ?? []) fs.rmSync(at(f), { force: true });
    if (layer.env) {
        let env = readText(at('.env.example'));
        for (const [k, v] of Object.entries(layer.env.set ?? {})) env = env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`);
        for (const k of layer.env.remove ?? []) env = env.replace(new RegExp(`^${k}=.*\\n`, 'm'), '');
        const add = Object.entries(layer.env.add ?? {});
        if (add.length) env = env.replace(/\n*$/, '\n') + `\n# ${layer.env.add_heading ?? 'Added by the example'}\n` + add.map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        write('.env.example', env);
    }
    return layer;
}

module.exports = { checkLayer, applyLayer, loadLayer };
