#!/usr/bin/env node
/**
 * `npm run docs` — open the handbook in the default browser.
 *
 * The handbook is a self-contained local file rather than a hosted page, deliberately: this repository
 * is private, and GitHub Pages would publish it to the open internet regardless of that. So there is no
 * URL to share — you open the file.
 *
 * Every platform spells "open this with the default application" differently, hence the switch.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const page = path.join(__dirname, '..', 'docs', 'index.html');

if (!fs.existsSync(page)) {
    console.error(`Handbook not found at ${page}`);
    console.error('Run this from the repository root, in a full clone.');
    process.exit(1);
}

const opener =
    process.platform === 'win32'
        ? { command: 'cmd', args: ['/c', 'start', '', page] } // '' is the window title `start` expects
        : process.platform === 'darwin'
            ? { command: 'open', args: [page] }
            : { command: 'xdg-open', args: [page] };

execFile(opener.command, opener.args, (error) => {
    if (error) {
        // A headless machine, or no registered browser. Not worth failing loudly over — print the path
        // so the reader can open it themselves.
        console.error(`Could not open a browser automatically: ${error.message}\n`);
        console.error(`Open this file by hand:\n  ${page}`);
        process.exitCode = 1;
        return;
    }
    console.log(`Opened the handbook: ${page}`);
});
