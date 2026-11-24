#!/usr/bin/env node
/**
 * `npm run env -- get <KEY>…` — read a setting from `.env` by name, for agents that must never open the file.
 *
 * Agents are denied reading `.env` because it holds the test accounts' passwords. Some settings in it are not
 * secret and an agent needs them: whose name goes on a report, which build is under test. This answers for
 * those keys only — the allow-list below — and refuses every other key, whatever it is called.
 *
 *   npm run env -- get QA_TESTER_NAME BUILD_UNDER_TEST    KEY=value lines; an unset key prints KEY=
 *   npm run env -- get QA_TESTER_NAME --json              {"QA_TESTER_NAME": "..."}
 *   npm run env -- list                                   the keys it will answer for
 *   npm run env -- now                                    the current time, ISO 8601 UTC — for a timestamp an agent records
 *
 * Adding a key: only a setting that is safe to print in a conversation, a report or a log. Never a password,
 * email, token, key or database setting — the harness-improver refuses such a change.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ALLOWED = ['QA_TESTER_NAME', 'QA_REPORT_FORMAT', 'BUILD_UNDER_TEST', 'TEST_ENVIRONMENT', 'APP_NAME', 'BASE_URL', 'TRACKER_PROJECT_KEY', 'DB_VALIDATION_ENABLED'];
/** Refused even if someone adds one to the list above by mistake. */
const NEVER = /PASSWORD|SECRET|TOKEN|EMAIL|API_KEY|_USER(NAME)?$|^DB_|^API_/;
const isAllowed = (k) => ALLOWED.includes(k) && !NEVER.test(k);

const [command, ...rest] = process.argv.slice(2);
const json = rest.includes('--json');
const keys = rest.filter((a) => !a.startsWith('--'));

if (command === 'now') {
    // Agents have no other sanctioned clock: a recorded time comes from here, never estimated or copied.
    console.log(new Date().toISOString());
    process.exit(0);
}
if (command === 'list') {
    console.log(ALLOWED.join('\n'));
    process.exit(0);
}
if (command !== 'get' || keys.length === 0) {
    console.error('usage: npm run env -- get <KEY>… [--json]   |   npm run env -- list   |   npm run env -- now');
    process.exit(1);
}

const file = path.join(__dirname, '..', '.env');
const values = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const out = {};
const refused = [];
for (const k of keys) {
    if (!isAllowed(k)) { refused.push(k); continue; }
    out[k] = (values[k] ?? '').trim();
}

if (json) console.log(JSON.stringify(out));
else for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
if (!fs.existsSync(file)) console.error('note: there is no .env yet — every key is unset. Copy .env.example to .env.');
if (refused.length) {
    console.error(`refused: ${refused.join(', ')} — not a setting agents may read. Allowed: ${ALLOWED.join(', ')}.`);
    process.exit(2);
}
