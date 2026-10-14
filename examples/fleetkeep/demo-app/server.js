// FleetKeep demo — a small, fictional fleet-maintenance app to practise the QA harness against.
// No dependencies: `node server.js`, then http://localhost:4300. All data is in memory; restart or
// POST /__reset to get the seed data back.
//
// Rules implemented (from the FleetKeep BA example): BR-002 categories A/B/C, BR-003 category A sets the
// vehicle VOR, BR-004 drivers report only for their own vehicles, BR-005 the defect lifecycle in order,
// BR-006 reject only from Triaged with a reason, BR-014 only a transport manager triages / rejects / raises
// a job card, BR-018 only a transport manager returns a vehicle to service, BR-019 only when every
// category-A defect on it is closed.
//
// One deliberate defect is planted for the practice run; see KNOWN-DEFECT.md — do not show it to the agents.

const http = require('http');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const PORT = Number(process.env.PORT || 4300);
// FLEETKEEP_FIXED=true runs the app as if a developer had fixed the planted defect — for practising the retest.
const DEFECT_FIXED = process.env.FLEETKEEP_FIXED === 'true';

// ---------------------------------------------------------------- data

const USERS = [
    { id: 'u1', email: 'dana.driver@fleetkeep.test', password: 'Drive-Demo-1', name: 'Dana Driver', role: 'driver' },
    { id: 'u2', email: 'theo.manager@fleetkeep.test', password: 'Manage-Demo-1', name: 'Theo Manager', role: 'transportManager' },
    { id: 'u3', email: 'tess.tech@fleetkeep.test', password: 'Fix-Demo-1', name: 'Tess Technician', role: 'technician' },
];
const ROLE_LABEL = { driver: 'Driver', transportManager: 'Transport manager', technician: 'Technician' };
const STATES = ['Reported', 'Triaged', 'Job card raised', 'In progress', 'Resolved', 'Closed'];

let db;
function seed() {
    db = {
        vehicles: [
            { reg: 'FK21 ABC', make: 'Volvo FH', depot: 'Leeds', status: 'Roadworthy', driverId: 'u1' },
            { reg: 'FK22 DEF', make: 'DAF XF', depot: 'Leeds', status: 'Roadworthy', driverId: 'u1' },
            { reg: 'FK19 GHJ', make: 'Scania R', depot: 'York', status: 'Roadworthy', driverId: null },
        ],
        defects: [
            { id: 'DEF-0001', reg: 'FK19 GHJ', category: 'B', description: 'Nearside mirror cracked', status: 'Triaged', reportedBy: 'u1', reportedAt: '2026-10-12 08:10', reason: null },
        ],
        audit: [],
        nextDefect: 2,
    };
}
seed();
const sessions = new Map();

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const userById = (id) => USERS.find((u) => u.id === id);
const vehicle = (reg) => db.vehicles.find((v) => v.reg === reg);
const defect = (id) => db.defects.find((d) => d.id === id);
const audit = (user, what) => db.audit.push({ at: now(), who: user.name, what });

function currentUser(req) {
    const sid = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === 'fk_sid')?.[1];
    return sid && sessions.has(sid) ? userById(sessions.get(sid)) : null;
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
    });
}

function send(res, status, html, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    res.end(html);
}
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };

const CSS = `
  :root { --bg:#f4f6f8; --ink:#1d2733; --muted:#5b6776; --line:#d9dee5; --brand:#0b6e4f; --warn:#a4400a; --bad:#b42318; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  header { background:#fff; border-bottom:1px solid var(--line); padding:10px 20px; display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
  header .brand { font-weight:700; color:var(--brand); }
  header nav { display:flex; gap:14px; }
  header nav a { color:var(--ink); text-decoration:none; }
  header .account { margin-left:auto; display:flex; gap:10px; align-items:center; color:var(--muted); }
  main { max-width:960px; margin:24px auto; padding:0 20px; }
  table { border-collapse:collapse; width:100%; background:#fff; border:1px solid var(--line); }
  th, td { text-align:left; padding:8px 10px; border-top:1px solid var(--line); }
  th { background:#eef1f4; font-size:13px; }
  .badge { font-size:12px; font-weight:600; padding:2px 8px; border-radius:99px; background:#e4efe9; color:var(--brand); }
  .badge.vor { background:#fde9e7; color:var(--bad); }
  .msg { padding:10px 14px; border-radius:6px; margin:0 0 16px; background:#e4efe9; }
  .msg.error { background:#fde9e7; color:var(--bad); }
  form.card, .card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:18px; max-width:520px; }
  label { display:block; font-weight:600; margin:12px 0 4px; }
  input, select, textarea { width:100%; padding:8px; font:inherit; border:1px solid var(--line); border-radius:6px; }
  fieldset { border:0; padding:0; margin:12px 0 0; } legend { font-weight:600; }
  fieldset label { font-weight:400; display:flex; gap:8px; align-items:center; margin:4px 0; } fieldset input { width:auto; }
  button { margin-top:14px; padding:8px 14px; font:inherit; border:0; border-radius:6px; background:var(--brand); color:#fff; cursor:pointer; }
  button.secondary { background:#fff; color:var(--ink); border:1px solid var(--line); }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .actions form { display:inline; }
`;

function page(user, title, body, msg) {
    const nav = user
        ? `<nav aria-label="Main">
             <a href="/dashboard">Dashboard</a>
             <a href="/vehicles">Vehicles</a>
             <a href="/defects">Defects</a>
             ${user.role === 'driver' ? '<a href="/defects/new">Report a defect</a>' : ''}
             ${user.role === 'transportManager' ? '<a href="/audit">Audit trail</a>' : ''}
           </nav>
           <div class="account" aria-label="Account">Signed in as <strong>${esc(user.name)}</strong> (${ROLE_LABEL[user.role]})
             <form method="post" action="/logout"><button class="secondary" type="submit">Sign out</button></form></div>`
        : '';
    const banner = msg ? `<p class="msg${msg.error ? ' error' : ''}" role="${msg.error ? 'alert' : 'status'}">${esc(msg.text)}</p>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · FleetKeep</title><style>${CSS}</style></head>
<body><header><span class="brand">FleetKeep</span>${nav}</header><main><h1>${esc(title)}</h1>${banner}${body}</main></body></html>`;
}

const flash = new Map(); // sid -> message, shown once
function setFlash(req, msg) {
    const sid = (req.headers.cookie || '').match(/fk_sid=([^;]+)/)?.[1];
    if (sid) flash.set(sid, msg);
}
function takeFlash(req) {
    const sid = (req.headers.cookie || '').match(/fk_sid=([^;]+)/)?.[1];
    const m = sid && flash.get(sid);
    if (sid) flash.delete(sid);
    return m;
}

// ---------------------------------------------------------------- pages

function loginPage(msg) {
    return page(null, 'Sign in', `
      <form class="card" method="post" action="/login">
        <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username">
        <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password">
        <button type="submit">Sign in</button>
        <p><a href="/forgot-password">Forgot your password?</a></p>
      </form>`, msg);
}

function visibleVehicles(user) {
    return user.role === 'driver' ? db.vehicles.filter((v) => v.driverId === user.id) : db.vehicles;
}
function visibleDefects(user) {
    if (user.role !== 'driver') return db.defects;
    const mine = visibleVehicles(user).map((v) => v.reg);
    return db.defects.filter((d) => mine.includes(d.reg));
}

function dashboard(user, msg) {
    const vs = visibleVehicles(user), ds = visibleDefects(user);
    const open = ds.filter((d) => !['Closed', 'Rejected'].includes(d.status));
    return page(user, 'Dashboard', `
      <div class="card"><p><strong>${vs.length}</strong> vehicles · <strong>${vs.filter((v) => v.status === 'VOR').length}</strong> off the road (VOR) ·
      <strong>${open.length}</strong> open defects</p></div>`, msg);
}

function vehiclesPage(user, msg) {
    const rows = visibleVehicles(user).map((v) => `
      <tr><td>${esc(v.reg)}</td><td>${esc(v.make)}</td><td>${esc(v.depot)}</td>
      <td><span class="badge${v.status === 'VOR' ? ' vor' : ''}">${v.status}</span></td>
      <td>${esc(userById(v.driverId)?.name ?? '—')}</td>
      <td>${user.role === 'transportManager' && v.status === 'VOR'
          ? `<form method="post" action="/vehicles/${encodeURIComponent(v.reg)}/return"><button type="submit">Return to service</button></form>` : ''}</td></tr>`).join('');
    return page(user, 'Vehicles', `<table><thead><tr><th>Registration</th><th>Make</th><th>Depot</th><th>Status</th><th>Driver</th><th></th></tr></thead><tbody>${rows}</tbody></table>`, msg);
}

function defectsPage(user, msg) {
    const rows = visibleDefects(user).map((d) => `
      <tr><td><a href="/defects/${d.id}">${d.id}</a></td><td>${esc(d.reg)}</td><td>${d.category}</td><td>${d.status}</td><td>${esc(d.reportedAt)}</td></tr>`).join('');
    return page(user, 'Defects', rows
        ? `<table><thead><tr><th>Defect</th><th>Vehicle</th><th>Category</th><th>Status</th><th>Reported</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p>No defects.</p>', msg);
}

function reportForm(user, msg) {
    const options = visibleVehicles(user).map((v) => `<option value="${esc(v.reg)}">${esc(v.reg)} — ${esc(v.make)}</option>`).join('');
    return page(user, 'Report a defect', `
      <form class="card" method="post" action="/defects/new">
        <label for="vehicle">Vehicle</label><select id="vehicle" name="vehicle"><option value="">Choose a vehicle</option>${options}</select>
        <fieldset><legend>Category</legend>
          <label><input type="radio" name="category" value="A"> A — immobilising: the vehicle must not be driven</label>
          <label><input type="radio" name="category" value="B"> B — repair within 48 hours</label>
          <label><input type="radio" name="category" value="C"> C — monitor, repair at the next service</label>
        </fieldset>
        <label for="description">Description</label><textarea id="description" name="description" rows="3"></textarea>
        <button type="submit">Report defect</button>
      </form>`, msg);
}

// The next state each role may move a defect to, from each state. BR-005, BR-014.
const MOVES = {
    transportManager: { Reported: ['Triaged'], Triaged: ['Job card raised', 'Rejected'], Resolved: ['Closed'] },
    technician: { 'Job card raised': ['In progress'], 'In progress': ['Resolved'] },
    driver: {},
};
const BUTTON = { Triaged: 'Triage', 'Job card raised': 'Raise job card', 'In progress': 'Start work', Resolved: 'Mark resolved', Closed: 'Close defect', Rejected: 'Reject' };

function defectPage(user, d, msg) {
    const moves = MOVES[user.role][d.status] ?? [];
    const actions = moves.map((to) => to === 'Rejected'
        ? `<form method="post" action="/defects/${d.id}/move"><input type="hidden" name="to" value="Rejected">
             <label for="reason">Reason for rejecting</label><input id="reason" name="reason">
             <button class="secondary" type="submit">Reject</button></form>`
        : `<form method="post" action="/defects/${d.id}/move"><input type="hidden" name="to" value="${esc(to)}"><button type="submit">${BUTTON[to]}</button></form>`).join('');
    return page(user, `Defect ${d.id}`, `
      <div class="card">
        <p><strong>Vehicle:</strong> ${esc(d.reg)}<br><strong>Category:</strong> ${d.category}<br>
        <strong>Status:</strong> <span id="defect-status">${d.status}</span><br><strong>Reported:</strong> ${esc(d.reportedAt)} by ${esc(userById(d.reportedBy)?.name)}<br>
        <strong>Description:</strong> ${esc(d.description)}${d.reason ? `<br><strong>Rejected because:</strong> ${esc(d.reason)}` : ''}</p>
        <div class="actions">${actions}</div>
      </div>
      <p><a href="/defects">Back to defects</a></p>`, msg);
}

// ---------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = decodeURIComponent(url.pathname);
    const user = currentUser(req);

    try {
        // ---- public
        if (path === '/__reset' && req.method === 'POST') { seed(); res.writeHead(204); return res.end(); }
        if (path === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
        if (path === '/') return redirect(res, user ? '/dashboard' : '/login');
        if (path === '/forgot-password') {
            return send(res, 200, page(null, 'Reset your password', `
              <form class="card" method="post" action="/forgot-password">
                <label for="reset-email">Email</label><input id="reset-email" name="email" type="email">
                <button type="submit">Send reset link</button>
                <p><a href="/login">Back to sign in</a></p></form>`,
              req.method === 'POST' ? { text: 'If that email has an account, we have sent a reset link.' } : null));
        }
        if (path === '/login' && req.method === 'GET') return send(res, 200, loginPage());
        if (path === '/login' && req.method === 'POST') {
            const { email, password } = await readBody(req);
            const u = USERS.find((x) => x.email === (email || '').trim().toLowerCase() && x.password === password);
            if (!u) return send(res, 200, loginPage({ error: true, text: 'Email or password is incorrect.' }));
            const sid = crypto.randomUUID();
            sessions.set(sid, u.id);
            return redirect(res, '/dashboard', { 'Set-Cookie': `fk_sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
        }
        if (!user) return redirect(res, '/login');

        // ---- signed in
        if (path === '/logout' && req.method === 'POST') {
            sessions.delete((req.headers.cookie || '').match(/fk_sid=([^;]+)/)?.[1]);
            return redirect(res, '/login', { 'Set-Cookie': 'fk_sid=; Path=/; Max-Age=0' });
        }
        if (path === '/dashboard') return send(res, 200, dashboard(user, takeFlash(req)));
        if (path === '/vehicles') return send(res, 200, vehiclesPage(user, takeFlash(req)));
        if (path === '/defects') return send(res, 200, defectsPage(user, takeFlash(req)));
        if (path === '/audit') {
            if (user.role !== 'transportManager') return send(res, 403, page(user, 'Not allowed', '<p>Only a transport manager can see the audit trail.</p>'));
            const rows = db.audit.map((a) => `<tr><td>${esc(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join('');
            return send(res, 200, page(user, 'Audit trail', rows ? `<table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Nothing yet.</p>'));
        }

        if (path === '/defects/new') {
            if (user.role !== 'driver') return send(res, 403, page(user, 'Not allowed', '<p>Only drivers report defects from a walkaround check.</p>'));
            if (req.method === 'GET') return send(res, 200, reportForm(user));
            const { vehicle: reg, category, description } = await readBody(req);
            const v = vehicle(reg);
            if (!v || v.driverId !== user.id) return send(res, 200, reportForm(user, { error: true, text: 'Choose one of your vehicles.' }));            // BR-004
            if (!['A', 'B', 'C'].includes(category)) return send(res, 200, reportForm(user, { error: true, text: 'Choose a category.' }));               // BR-002
            if (!(description || '').trim()) return send(res, 200, reportForm(user, { error: true, text: 'Describe the defect.' }));
            const id = `DEF-${String(db.nextDefect++).padStart(4, '0')}`;
            db.defects.push({ id, reg, category, description: description.trim(), status: 'Reported', reportedBy: user.id, reportedAt: now(), reason: null });
            if (category === 'A') v.status = 'VOR';                                                                                                        // BR-003
            audit(user, `Reported ${id} (category ${category}) on ${reg}`);
            setFlash(req, { text: `Defect ${id} reported.${category === 'A' ? ` ${reg} is now off the road (VOR).` : ''}` });
            return redirect(res, '/defects');
        }

        let m = path.match(/^\/defects\/(DEF-\d{4})$/);
        if (m) {
            const d = defect(m[1]);
            if (!d || !visibleDefects(user).includes(d)) return send(res, 404, page(user, 'Not found', '<p>No such defect.</p>'));
            return send(res, 200, defectPage(user, d, takeFlash(req)));
        }

        m = path.match(/^\/defects\/(DEF-\d{4})\/move$/);
        if (m && req.method === 'POST') {
            const d = defect(m[1]);
            const { to, reason } = await readBody(req);
            if (!d) return send(res, 404, page(user, 'Not found', '<p>No such defect.</p>'));
            if (!(MOVES[user.role][d.status] ?? []).includes(to)) {
                setFlash(req, { error: true, text: `You can't move ${d.id} from ${d.status} to ${to}.` });                                                  // BR-005, BR-014
                return redirect(res, `/defects/${d.id}`);
            }
            if (to === 'Rejected' && !(reason || '').trim()) {
                setFlash(req, { error: true, text: 'Give a reason for rejecting the defect.' });                                                          // BR-006
                return redirect(res, `/defects/${d.id}`);
            }
            const from = d.status;
            d.status = to;
            if (to === 'Rejected') d.reason = reason.trim();
            audit(user, `Moved ${d.id} from ${from} to ${to}${to === 'Rejected' ? ` — ${reason.trim()}` : ''}`);
            setFlash(req, { text: `${d.id} is now ${to}.` });
            return redirect(res, `/defects/${d.id}`);
        }

        m = path.match(/^\/vehicles\/(.+)\/return$/);
        if (m && req.method === 'POST') {
            const v = vehicle(m[1]);
            if (!v) return send(res, 404, page(user, 'Not found', '<p>No such vehicle.</p>'));
            if (user.role !== 'transportManager') {                                                                                                         // BR-018
                setFlash(req, { error: true, text: 'Only a transport manager can return a vehicle to service.' });
                return redirect(res, '/vehicles');
            }
            const done = DEFECT_FIXED ? ['Closed'] : ['Closed', 'Resolved'];                                                                                // BR-019 — see KNOWN-DEFECT.md
            const blocking = db.defects.filter((d) => d.reg === v.reg && d.category === 'A' && !done.includes(d.status));
            if (blocking.length) {
                setFlash(req, { error: true, text: `${v.reg} can't return to service: category-A defect ${blocking.map((d) => d.id).join(', ')} is not closed.` });
                return redirect(res, '/vehicles');
            }
            v.status = 'Roadworthy';
            audit(user, `Returned ${v.reg} to service`);
            setFlash(req, { text: `${v.reg} is back in service.` });
            return redirect(res, '/vehicles');
        }

        return send(res, 404, page(user, 'Not found', '<p>That page does not exist.</p>'));
    } catch (error) {
        console.error(error);
        return send(res, 500, page(user, 'Something went wrong', '<p>Try again.</p>'));
    }
});

server.listen(PORT, () => console.log(`FleetKeep demo on http://localhost:${PORT}${DEFECT_FIXED ? ' — planted defect fixed' : ''}`));
