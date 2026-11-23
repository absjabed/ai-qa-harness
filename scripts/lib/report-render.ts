/**
 * Renders a test report into HTML and PDF from its Markdown — the committed, canonical copy — and its numbers.
 *
 * The Markdown is the report scripts/lib/cycle.ts writes. The HTML shows the same content laid out for a reader:
 * a verdict banner, the headline figures, a bar of how the test cases ended, the report's details as a grid,
 * and statuses in colour as well as words. Every figure comes from the report's own metrics; nothing is
 * computed here. The PDF is the same page printed by Playwright's own Chromium, already installed for the
 * suite, so nothing new is needed.
 */

import fs from 'fs';
import type { CycleMetrics } from './cycle';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
    return escapeHtml(text)
        .replace(/\\\|/g, '|')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])_([^_]+)_(?=$|[\s.,;:)])/g, '$1<em>$2</em>');
}

/** Splits a pipe-table row on unescaped pipes. */
function cells(row: string): string[] {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

const isSeparator = (row: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(row.trim());

/** Status words shown as coloured pills when they make up a whole table cell. */
const PILLS: Record<string, string> = {
    'passed': 'pass', 'passing': 'pass', 'met': 'pass', 'verified': 'pass', 'yes': 'pass',
    'failed': 'fail', 'failing': 'fail', 'not met': 'fail', 'no': 'fail',
    'blocked': 'warn', 'blocked by defect': 'warn', 'raised': 'warn', 'pending': 'warn',
    'flaky': 'flaky',
    'not run': 'muted', 'not executed': 'muted', 'not covered': 'fail', 'skipped': 'muted',
};

function cellHtml(raw: string): string {
    const plain = raw.replace(/\*\*/g, '').trim();
    const pill = PILLS[plain.toLowerCase()];
    return pill ? `<span class="pill ${pill}">${escapeHtml(plain)}</span>` : inline(raw);
}

function tableHtml(block: string[]): string {
    const [head, ...rest] = block;
    const headers = cells(head);
    const body = rest.filter((r) => !isSeparator(r));
    // The report's first table — Field | Value — is shown as a grid of details, not a table.
    if (headers.length === 2 && headers[0] === 'Field' && headers[1] === 'Value') {
        return `<dl class="details">${body.map((r) => {
            const [k, v] = cells(r);
            return `<div><dt>${inline(k)}</dt><dd>${inline(v ?? '')}</dd></div>`;
        }).join('')}</dl>`;
    }
    // Right-align counts and rates; a release, epic or date only looks numeric.
    const TEXT_COLUMNS = ['release', 'epic', 'date', 'threshold', 'actual'];
    const numeric = headers.map((h, i) => !TEXT_COLUMNS.includes(h.toLowerCase()) && body.length > 0 && body.every((r) => /^[\d.%/—\s*-]*$/.test(cells(r)[i] ?? '')));
    return `<div class="table"><table><thead><tr>${headers.map((h, i) => `<th${numeric[i] ? ' class="num"' : ''}>${inline(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${body.map((r) => {
            const total = /^\*\*Total\*\*/.test(cells(r)[0] ?? '');
            return `<tr${total ? ' class="total"' : ''}>${cells(r).map((c, i) => `<td${numeric[i] ? ' class="num"' : ''}>${cellHtml(c)}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div>`;
}

/** The Markdown body as HTML. The Summary section is left out — the verdict banner carries it. */
function bodyHtml(md: string): { html: string; summary: string } {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let summary = '';
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        if (/^# /.test(line)) { i++; continue; } // the title is in the page header

        if (line === '## Summary') {
            i++;
            const para: string[] = [];
            while (i < lines.length && !/^## /.test(lines[i])) para.push(lines[i++]);
            summary = para.join(' ').trim();
            continue;
        }

        const heading = line.match(/^(#{2,3}) (.*)$/);
        if (heading) {
            out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
            i++;
            continue;
        }

        if (line.trim().startsWith('|')) {
            const block: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) block.push(lines[i++]);
            out.push(tableHtml(block));
            continue;
        }

        if (line.startsWith('> ')) {
            const quote: string[] = [];
            while (i < lines.length && lines[i].startsWith('> ')) quote.push(lines[i++].slice(2));
            out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
            continue;
        }

        if (/^- /.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
            out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
            continue;
        }

        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\||> |- )/.test(lines[i])) para.push(lines[i++]);
        const text = para.join(' ');
        out.push(/^_.*_$/.test(text.trim()) ? `<p class="intro">${inline(text.trim().slice(1, -1))}</p>` : `<p>${inline(text)}</p>`);
    }
    return { html: out.join('\n'), summary };
}

const OUTCOMES: { key: keyof CycleMetrics['outcomes']; label: string; cls: string }[] = [
    { key: 'Passed', label: 'Passed', cls: 'pass' },
    { key: 'Flaky', label: 'Flaky', cls: 'flaky' },
    { key: 'Failed', label: 'Failed', cls: 'fail' },
    { key: 'Blocked', label: 'Blocked', cls: 'warn' },
    { key: 'Skipped', label: 'Skipped', cls: 'skip' },
    { key: 'Not Run', label: 'Not run', cls: 'muted' },
];

function dashboard(m: CycleMetrics, summary: string): string {
    const n = (k: keyof CycleMetrics['outcomes']) => m.outcomes[k].automated + m.outcomes[k].manual;
    const passing = n('Passed') + n('Flaky');
    const rate = m.total ? Math.round((passing / m.total) * 100) : 0;
    const tiles = [
        { label: 'Pass rate', value: `${rate}%`, note: `${passing} of ${m.total} test cases`, cls: m.allMet ? 'pass' : rate >= 90 ? 'warn' : 'fail' },
        { label: 'Failed', value: String(n('Failed')), note: 'need a fix or a defect', cls: n('Failed') ? 'fail' : 'neutral' },
        { label: 'Blocked', value: String(n('Blocked')), note: 'by a known defect', cls: n('Blocked') ? 'warn' : 'neutral' },
        { label: 'Not run', value: String(n('Not Run')), note: 'not executed yet', cls: n('Not Run') ? 'warn' : 'neutral' },
        { label: 'Open defects', value: String(m.openDefects.length), note: m.openDefects.length ? m.openDefects.map((d) => d.trackerKey !== '—' ? d.trackerKey : d.severity).join(', ') : 'none open', cls: m.openDefects.length ? 'fail' : 'neutral' },
        { label: 'Acceptance criteria', value: `${m.acceptanceCriteria.passing}/${m.acceptanceCriteria.total}`, note: 'proven by a passing case', cls: m.acceptanceCriteria.passing === m.acceptanceCriteria.total ? 'pass' : 'warn' },
    ];
    const bar = m.total
        ? OUTCOMES.filter((o) => n(o.key) > 0).map((o) => `<span class="seg ${o.cls}" style="flex:${n(o.key)}" title="${o.label}: ${n(o.key)}"></span>`).join('')
        : '<span class="seg muted" style="flex:1"></span>';
    const pct = (k: keyof CycleMetrics['outcomes']) => (m.total ? Math.round((n(k) / m.total) * 100) : 0);
    const legend = OUTCOMES.filter((o) => n(o.key) > 0).map((o) => `<span><i class="${o.cls}"></i>${o.label} <b>${n(o.key)}</b> · ${pct(o.key)}%</span>`).join('');
    const summaryText = summary.replace(/^\*\*[^*]+\*\*\s*—\s*/, '');
    return `
<section class="verdict ${m.allMet ? 'met' : 'notmet'}">
  <div class="verdict-mark">${m.allMet ? '✓' : '!'}</div>
  <div>
    <p class="verdict-title">${m.allMet ? 'Exit criteria met' : 'Exit criteria not met'}</p>
    <p class="verdict-text">${inline(summaryText)}</p>
  </div>
</section>
<section class="tiles">
  ${tiles.map((t) => `<div class="tile ${t.cls}"><span class="tile-label">${t.label}</span><span class="tile-value">${t.value}</span><span class="tile-note">${escapeHtml(t.note)}</span></div>`).join('\n  ')}
</section>
<section class="progress" aria-label="How the ${m.total} test cases ended">
  <div class="bar">${bar}</div>
  <div class="legend"><span class="legend-total">${m.total} test case${m.total === 1 ? '' : 's'}</span>${legend}</div>
</section>`;
}

export function reportToHtml(md: string, title: string, metrics?: CycleMetrics): string {
    const { html, summary } = bodyHtml(md);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --ink: #1b2430; --muted: #5b6576; --line: #e3e7ee; --surface: #f6f8fb; --paper: #ffffff; --accent: #2f5bd3;
    --pass: #1f7a4d; --pass-bg: #e6f4ec; --fail: #b42318; --fail-bg: #fdecea; --warn: #a3530b; --warn-bg: #fdf0e3;
    --flaky: #6b3fd1; --flaky-bg: #efe9fc; --skip: #8a94a6; --skip-bg: #eef1f5;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 16px 48px; background: var(--surface); color: var(--ink);
         font: 14px/1.55 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  main { max-width: 1000px; margin: 0 auto; }
  header.top { padding: 28px 0 18px; border-bottom: 3px solid var(--accent); margin-bottom: 18px; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin: 0; }
  h1 { font-size: 26px; line-height: 1.2; margin: 6px 0 0; }
  h2 { font-size: 17px; margin: 30px 0 4px; }
  h3 { font-size: 15px; margin: 18px 0 6px; }
  p { margin: 6px 0; }
  p.intro { color: var(--muted); margin: 0 0 10px; font-size: 13px; }
  code { font-family: Consolas, "Cascadia Code", Menlo, monospace; font-size: 12px; background: var(--surface);
         border: 1px solid var(--line); padding: 0 4px; border-radius: 4px; }

  .verdict { display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; border-radius: 12px; margin: 0 0 14px; }
  .verdict.met { background: var(--pass-bg); border: 1px solid #b8dfc9; }
  .verdict.notmet { background: var(--fail-bg); border: 1px solid #f3c2bd; }
  .verdict-mark { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
                  color: #fff; font-weight: 800; font-size: 18px; }
  .met .verdict-mark { background: var(--pass); } .notmet .verdict-mark { background: var(--fail); }
  .verdict-title { font-size: 18px; font-weight: 700; margin: 2px 0 2px; }
  .met .verdict-title { color: var(--pass); } .notmet .verdict-title { color: var(--fail); }
  .verdict-text { margin: 0; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .tile { background: var(--paper); border: 1px solid var(--line); border-top: 4px solid var(--line); border-radius: 10px;
          padding: 10px 12px; display: flex; flex-direction: column; min-width: 0; }
  .tile.pass { border-top-color: var(--pass); } .tile.fail { border-top-color: var(--fail); } .tile.warn { border-top-color: var(--warn); }
  .tile-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .tile-value { font-size: 26px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
  .tile.pass .tile-value { color: var(--pass); } .tile.fail .tile-value { color: var(--fail); } .tile.warn .tile-value { color: var(--warn); }
  .tile-note { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }

  .progress { margin: 0 0 14px; }
  .bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--skip-bg); gap: 2px; }
  .seg { display: block; min-width: 4px; }
  .seg.pass, .legend i.pass { background: var(--pass); } .seg.fail, .legend i.fail { background: var(--fail); }
  .seg.warn, .legend i.warn { background: var(--warn); } .seg.flaky, .legend i.flaky { background: var(--flaky); }
  .seg.skip, .legend i.skip { background: var(--skip); } .seg.muted, .legend i.muted { background: #c5ccd8; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 6px; font-size: 12px; color: var(--muted); }
  .legend b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .legend-total { font-weight: 600; color: var(--ink); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }

  dl.details { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0; background: var(--paper);
               border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin: 0 0 6px; }
  dl.details div { padding: 8px 12px; min-width: 0; box-shadow: inset -1px -1px 0 var(--line); }
  dt { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  dd { margin: 2px 0 0; overflow-wrap: anywhere; }

  .table { overflow-x: auto; margin: 4px 0 10px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { padding: 8px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
  tbody tr:last-child td { border-bottom: 0; }
  th { background: var(--surface); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 700; background: var(--surface); }
  .pill { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .pill.pass { background: var(--pass-bg); color: var(--pass); } .pill.fail { background: var(--fail-bg); color: var(--fail); }
  .pill.warn { background: var(--warn-bg); color: var(--warn); } .pill.flaky { background: var(--flaky-bg); color: var(--flaky); }
  .pill.muted { background: var(--skip-bg); color: var(--muted); }

  blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid var(--warn); background: var(--warn-bg); border-radius: 0 8px 8px 0; }
  ul { margin: 6px 0; padding-left: 20px; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }

  @media print {
    body { background: #fff; padding: 0; }
    header.top { padding-top: 0; }
    h2 { break-after: avoid; }
    tr, .tile, .verdict, dl.details div { break-inside: avoid; }
  }
</style>
</head>
<body><main>
<header class="top">
  <p class="eyebrow">QA test report</p>
  <h1>${escapeHtml(title.replace(/^(QA test report|Test cycle summary) — /, ''))}</h1>
</header>
${metrics ? dashboard(metrics, summary) : summary ? `<p>${inline(summary)}</p>` : ''}
${html}
<footer>Generated by the QA harness from its test records. Every figure comes from the plans, the results record, the manual results and the defect log.</footer>
</main></body>
</html>
`;
}

/** Prints an HTML report to PDF with Playwright's Chromium. */
export async function htmlToPdf(html: string, pdfPath: string): Promise<void> {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
        });
    } finally {
        await browser.close();
    }
}

/** Writes the HTML and/or PDF beside the Markdown report. Returns the paths written. */
export async function renderReport(mdPath: string, title: string, formats: string[], metrics?: CycleMetrics): Promise<string[]> {
    const written: string[] = [];
    if (!formats.includes('html') && !formats.includes('pdf')) return written;
    const html = reportToHtml(fs.readFileSync(mdPath, 'utf8'), title, metrics);
    if (formats.includes('html')) {
        const htmlPath = mdPath.replace(/\.md$/, '.html');
        fs.writeFileSync(htmlPath, html, 'utf8');
        written.push(htmlPath);
    }
    if (formats.includes('pdf')) {
        const pdfPath = mdPath.replace(/\.md$/, '.pdf');
        await htmlToPdf(html, pdfPath);
        written.push(pdfPath);
    }
    return written;
}
