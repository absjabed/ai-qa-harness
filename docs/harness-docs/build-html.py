#!/usr/bin/env python3
"""Build docs/how-it-works.html from docs/harness-docs/ai-qa-harness.md.

    python docs/harness-docs/build-html.py          # write the page
    python docs/harness-docs/build-html.py --check  # exit 1 if the page is out of date

The Markdown guide is the source; never edit the HTML by hand. The page borrows its stylesheet and
font links from docs/index.html so the handbook pages look alike. Links in the guide are relative to
docs/harness-docs/; they are rewritten relative to docs/ so the page works opened straight from disk.
Standard library only; the output is deterministic.
"""
import html
import os
import re
import struct
import sys
from urllib.parse import quote, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
REPO = os.path.dirname(DOCS)
SRC = os.path.join(HERE, 'ai-qa-harness.md')
OUT = os.path.join(DOCS, 'how-it-works.html')
STYLE_FROM = os.path.join(DOCS, 'index.html')
SRC_REL = 'docs/harness-docs/ai-qa-harness.md'
DRAWIO = 'harness-docs/diagrams/ai-qa-harness/ai-qa-harness.drawio'

EXTRA_CSS = """
/* ---------- how-it-works.html: generated from docs/harness-docs/ai-qa-harness.md ---------- */
h2[id], h3[id], h4[id], h5[id], h6[id] { scroll-margin-top: 24px; }
h2 .num { font-family: var(--mono); font-size: .78em; font-weight: 500; color: var(--ink-faint); margin-right: .45rem; }
.nav a .ord { min-width: 18px; }
.back { display: inline-block; font-family: var(--mono); font-size: 11.5px; letter-spacing: .02em; text-decoration: none; margin: 0 0 6px; }
.main pre { margin: 0 0 16px; max-width: 100%; }
.main li > pre { margin: 6px 0 8px; }
.main li > p { margin: 0 0 6px; }
.table-wrap { max-width: 100%; }
.table-wrap td code { white-space: normal; }
.table-wrap td { overflow-wrap: anywhere; }
figure.diagram { margin: 4px 0 22px; max-width: 100%; }
figure.diagram a { display: block; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px; box-shadow: var(--shadow); }
figure.diagram img { display: block; width: 100%; height: auto; }
figure.diagram figcaption { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); margin-top: 6px; }
blockquote.note { margin-left: 0; margin-right: 0; }
.footer p { max-width: none; }
@media (max-width: 860px) { h2[id], h3[id], h4[id], h5[id], h6[id] { scroll-margin-top: 72px; } }
"""

SCRIPT = """
(function () {
  'use strict';
  var root = document.documentElement;
  function readStored() { try { return localStorage.getItem('qa-handbook-theme'); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem('qa-handbook-theme', v); } catch (e) { /* private mode */ } }
  var stored = readStored();
  if (stored === 'dark' || stored === 'light') root.setAttribute('data-theme', stored);
  function currentlyDark() {
    var attr = root.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  ['theme-btn', 'theme-btn-mobile'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () {
      var next = currentlyDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store(next);
    });
  });

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  function setActive(id) {
    links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + id); });
  }
  var sections = links.map(function (a) {
    var h = document.getElementById(a.getAttribute('href').slice(1));
    return h ? (h.closest('section') || h) : null;
  }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var visible = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var h = e.target.querySelector('h2[id]') || e.target;
        visible.set(h.id, e.isIntersecting ? e.intersectionRatio : 0);
      });
      var best = null, bestRatio = 0;
      visible.forEach(function (r, id) { if (r > bestRatio) { bestRatio = r; best = id; } });
      if (best) setActive(best);
    }, { rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.25, 0.5, 1] });
    sections.forEach(function (s) { observer.observe(s); });
  }

  var mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.addEventListener('change', function () {
    var target = document.getElementById(mobileNav.value.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
"""

WARNINGS = []


def warn(msg):
    if msg not in WARNINGS:
        WARNINGS.append(msg)


# ---------- inline Markdown ----------

CODE_RE = re.compile(r'(`+)(.+?)(?<!`)\1(?!`)')
IMG_RE = re.compile(r'!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
LINK_RE = re.compile(r'\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
BOLD_RE = re.compile(r'\*\*(?=\S)(.+?)(?<=\S)\*\*')
EM_RE = re.compile(r'(?<![\w*])\*(?=[^*\s])([^*]*?[^*\s])\*(?![\w*])')
ESC_RE = re.compile(r'\\([\\`*_{}\[\]()#+\-.!|<>~])')


def plain(md):
    """Markdown inline text with its formatting removed (sidebar labels, slugs, alt text)."""
    t = IMG_RE.sub(lambda m: m.group(1), md)
    t = LINK_RE.sub(lambda m: m.group(1), t)
    t = CODE_RE.sub(lambda m: m.group(2).strip(), t)
    t = BOLD_RE.sub(r'\1', t)
    t = EM_RE.sub(r'\1', t)
    t = ESC_RE.sub(r'\1', t)
    return t.strip()


class Slugger:
    """GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats numbered."""

    def __init__(self):
        self.seen = {}

    def __call__(self, text):
        base = re.sub(r'[^\w\- ]', '', plain(text).lower()).replace(' ', '-')
        n = self.seen.get(base, 0)
        self.seen[base] = n + 1
        return base if n == 0 else f'{base}-{n}'


def href_for(target):
    """Map a link in the Markdown (relative to docs/harness-docs/) to one that works from docs/."""
    if target.startswith('#') or re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', target):
        if 'github.com' in target:
            warn(f'GitHub URL kept as written in the guide: {target}')
        return target
    path, hash_, frag = target.partition('#')
    full = os.path.normpath(os.path.join(HERE, unquote(path)))
    if os.path.normcase(full) == os.path.normcase(SRC):
        return '#' + frag if frag else '#top'
    if not os.path.exists(full):
        warn(f'link target not found: {target}')
    if not os.path.normcase(full).startswith(os.path.normcase(REPO + os.sep)):
        warn(f'link points outside the repo: {target}')
    rel = os.path.relpath(full, DOCS).replace(os.sep, '/')
    if path.endswith('/') and not rel.endswith('/'):
        rel += '/'
    return quote(rel) + hash_ + frag


def png_size(src):
    """Width and height from a PNG's IHDR chunk, so anchors don't jump while images load."""
    path = os.path.join(DOCS, unquote(src).replace('/', os.sep))
    try:
        with open(path, 'rb') as f:
            head = f.read(24)
    except OSError:
        warn(f'image not found: {src}')
        return None
    if head[:8] != b'\x89PNG\r\n\x1a\n' or head[12:16] != b'IHDR':
        warn(f'image is not a PNG, no size given: {src}')
        return None
    return struct.unpack('>II', head[16:24])


def img_tag(alt, target):
    src = href_for(target)
    size = png_size(src) if not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', src) else None
    dims = f' width="{size[0]}" height="{size[1]}"' if size else ''
    return f'<img src="{html.escape(src)}" alt="{html.escape(plain(alt))}"{dims} loading="lazy">'


def inline(text):
    keep = []

    def stash(s):
        keep.append(s)
        return f'\x00{len(keep) - 1}\x00'

    def fmt(t):
        t = ESC_RE.sub(lambda m: stash(html.escape(m.group(1), quote=False)), t)
        t = html.escape(t, quote=False)
        t = BOLD_RE.sub(r'<strong>\1</strong>', t)
        t = EM_RE.sub(r'<em>\1</em>', t)
        return t

    text = CODE_RE.sub(lambda m: stash(f'<code>{html.escape(m.group(2).strip(), quote=False)}</code>'), text)
    text = IMG_RE.sub(lambda m: stash(img_tag(restore(m.group(1), keep), m.group(2))), text)
    text = LINK_RE.sub(lambda m: stash(f'<a href="{html.escape(href_for(m.group(2)))}">{fmt(m.group(1))}</a>'), text)
    text = re.sub(r'<(https?://[^>\s]+)>', lambda m: stash(f'<a href="{html.escape(m.group(1))}">{html.escape(m.group(1))}</a>'), text)
    return restore(fmt(text), keep)


def restore(text, keep):
    while '\x00' in text:
        text = re.sub(r'\x00(\d+)\x00', lambda m: keep[int(m.group(1))], text)
    return text


def label(md):
    """Sidebar text: no code formatting, links or emphasis."""
    return html.escape(re.sub(r'<[^>]+>', '', plain(md)), quote=False)


# ---------- blocks ----------

MARK_RE = re.compile(r'^( {0,})([-*+]|\d{1,9}[.)])( +|$)(.*)$')
HEAD_RE = re.compile(r'^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$')
RULE_RE = re.compile(r'^ {0,3}([-*_])(?:\s*\1){2,}\s*$')
FENCE_RE = re.compile(r'^( *)(`{3,}|~{3,})\s*([^`\s]*)')
SEP_RE = re.compile(r'^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$')
IMG_LINE_RE = re.compile(r'^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$')


def is_table_start(lines, i):
    return ('|' in lines[i] and i + 1 < len(lines) and '|' in lines[i + 1]
            and '-' in lines[i + 1] and SEP_RE.match(lines[i + 1]) is not None)


def starts_block(line):
    s = line.strip()
    return bool(HEAD_RE.match(line) or RULE_RE.match(line) or FENCE_RE.match(line)
                or s.startswith('>') or s.startswith('|'))


def split_cells(row):
    row = row.strip()
    if row.startswith('|'):
        row = row[1:]
    if row.endswith('|') and not row.endswith('\\|'):
        row = row[:-1]
    return [p.strip().replace('\\|', '|') for p in re.split(r'(?<!\\)\|', row)]


def table(rows):
    aligns = []
    for c in split_cells(rows[1]):
        left, right = c.startswith(':'), c.endswith(':')
        aligns.append('center' if left and right else 'right' if right else 'left' if left else '')
    head = split_cells(rows[0])
    ncol = len(head)

    def attr(j):
        a = aligns[j] if j < len(aligns) else ''
        return f' style="text-align:{a}"' if a else ''

    out = ['<div class="table-wrap"><table>', '<thead><tr>'
           + ''.join(f'<th{attr(j)}>{inline(c)}</th>' for j, c in enumerate(head)) + '</tr></thead>', '<tbody>']
    for r in rows[2:]:
        cs = (split_cells(r) + [''] * ncol)[:ncol]
        out.append('<tr>' + ''.join(f'<td{attr(j)}>{inline(c)}</td>' for j, c in enumerate(cs)) + '</tr>')
    out.append('</tbody></table></div>')
    return '\n'.join(out)


def code_block(lang, code):
    cls = f' class="language-{html.escape(lang)}"' if lang else ''
    return f'<pre><code{cls}>{html.escape(chr(10).join(code), quote=False)}</code></pre>'


def read_fence(lines, i, strip):
    """Read a fenced block starting at lines[i]; returns (html, next index)."""
    m = FENCE_RE.match(lines[i])
    fence = m.group(2)
    lang = m.group(3)
    code = []
    i += 1
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith(fence[0] * len(fence)) and not s.strip(fence[0]):
            i += 1
            break
        ln = lines[i]
        n = len(ln) - len(ln.lstrip(' '))
        code.append(ln[min(n, strip):])
        i += 1
    return code_block(lang, code), i


def parse_list(lines, i):
    """Parse a (possibly nested) list starting at lines[i]; returns (html, next index)."""
    m = MARK_RE.match(lines[i])
    indent = len(m.group(1))
    ordered = m.group(2)[0].isdigit()
    start = int(m.group(2)[:-1]) if ordered else 1
    items = []  # each item: list of ('text', [lines]) / ('html', str)
    content = indent + 1  # becomes the first item's content column once it is read
    loose = False
    while i < len(lines):
        line = lines[i]
        m = MARK_RE.match(line)
        if not line.strip():
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j >= len(lines):
                i = j
                break
            nxt = lines[j]
            nm = MARK_RE.match(nxt)
            nind = len(nxt) - len(nxt.lstrip(' '))
            if nm and nind == indent and nm.group(2)[0].isdigit() == ordered:
                loose = True
                i = j
                continue
            if nind >= content and items:
                items[-1].append(('text', []))
                loose = True
                i = j
                continue
            i = j
            break
        lind = len(line) - len(line.lstrip(' '))
        if m and lind < content and lind >= indent:
            if m.group(2)[0].isdigit() != ordered:
                break
            items.append([('text', [m.group(4)])])
            content = indent + len(m.group(2)) + max(1, min(len(m.group(3)), 4))
            i += 1
        elif m and lind < indent:
            break
        elif m and lind >= content and items:
            sub, i = parse_list(lines, i)
            items[-1].append(('html', sub))
        elif FENCE_RE.match(line) and lind >= content and items:
            block, i = read_fence(lines, i, content)
            items[-1].append(('html', block))
        elif items and (lind >= content or (lind > indent and not starts_block(line))
                        or (not starts_block(line) and items[-1][-1][0] == 'text' and items[-1][-1][1])):
            if items[-1][-1][0] != 'text':
                items[-1].append(('text', []))
            items[-1][-1][1].append(line.strip())
            i += 1
        else:
            break
    tag = 'ol' if ordered else 'ul'
    attrs = f' start="{start}"' if ordered and start != 1 else ''
    out = []
    for it in items:
        parts = []
        texts = [p for p in it if p[0] == 'text' and p[1]]
        for kind, val in it:
            if kind == 'html':
                parts.append(val)
            elif val:
                t = inline(' '.join(val))
                parts.append(f'<p>{t}</p>' if loose or len(texts) > 1 else t)
        out.append('<li>' + ''.join(parts) + '</li>')
    return f'<{tag}{attrs}>' + ''.join(out) + f'</{tag}>', i


def convert(md):
    lines = md.replace('\r\n', '\n').replace('\t', '    ').split('\n')
    slug = Slugger()
    body, nav, para = [], [], []
    title, lede = '', ''
    in_section = False
    i = 0

    def flush():
        nonlocal lede
        if para:
            text = inline(' '.join(s.strip() for s in para))
            if title and not lede and not body:
                lede = text
            else:
                body.append(f'<p>{text}</p>')
            para.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        hm = HEAD_RE.match(line)
        mm = MARK_RE.match(line)
        if FENCE_RE.match(line) and len(line) - len(line.lstrip(' ')) < 4:
            flush()
            block, i = read_fence(lines, i, len(line) - len(line.lstrip(' ')))
            body.append(block)
            continue
        if hm:
            flush()
            level, text = len(hm.group(1)), hm.group(2).strip()
            if level == 1 and not title:
                title = text
                slug(text)
            elif level == 2 and plain(text) == 'Contents':
                # The sidebar replaces the guide's own contents list: skip to the next "## " heading.
                slug(text)
                i += 1
                while i < len(lines) and not re.match(r'^ {0,3}##\s', lines[i]):
                    i += 1
                continue
            elif level == 2:
                anchor = slug(text)
                html_text = inline(text)
                num = re.match(r'^(\d+)\.\s+(.*)$', text)
                heading = (f'<span class="num">{num.group(1)}.</span>{inline(num.group(2))}' if num else html_text)
                nav.append((anchor, num.group(1) if num else '·', label(num.group(2) if num else text)))
                if in_section:
                    body.append('</section>')
                body.append('<section>')
                in_section = True
                body.append(f'<h2 id="{anchor}">{heading}</h2>')
            else:
                body.append(f'<h{level} id="{slug(text)}">{inline(text)}</h{level}>')
        elif RULE_RE.match(line):
            flush()  # rules separate sections in the Markdown; the page's h2 borders do that job
        elif IMG_LINE_RE.match(s) and not para:
            flush()
            alt, target = IMG_LINE_RE.match(s).groups()
            img = img_tag(alt, target)
            src = re.search(r'src="([^"]*)"', img).group(1)
            body.append(f'<figure class="diagram"><a href="{src}" title="Open full size">{img}</a>'
                        f'<figcaption>Click the diagram to open it full size.</figcaption></figure>')
        elif is_table_start(lines, i):
            flush()
            rows = []
            while i < len(lines) and lines[i].strip() and '|' in lines[i] and not HEAD_RE.match(lines[i]):
                rows.append(lines[i])
                i += 1
            body.append(table(rows))
            continue
        elif mm and len(mm.group(1)) < 4 and mm.group(4).strip() and (
                not para or not mm.group(2)[0].isdigit() or mm.group(2)[:-1] == '1'):
            flush()
            block, i = parse_list(lines, i)
            body.append(block)
            continue
        elif s.startswith('>'):
            flush()
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                quote_lines.append(re.sub(r'^\s*>\s?', '', lines[i]))
                i += 1
            paras = [p for p in re.split(r'\n\s*\n', '\n'.join(quote_lines)) if p.strip()]
            body.append('<blockquote class="note">'
                        + ''.join(f'<p>{inline(" ".join(x.strip() for x in p.split(chr(10))))}</p>' for p in paras)
                        + '</blockquote>')
            continue
        elif not s:
            flush()
        else:
            para.append(line)
        i += 1
    flush()
    if in_section:
        body.append('</section>')
    return title, lede, nav, '\n'.join(body)


# ---------- page ----------

def page(title, lede, nav, intro_and_body, style, fonts):
    intro, body = intro_and_body
    nav_html = '\n'.join(f'      <a href="#{a}"><span class="ord">{o}</span> {t}</a>' for a, o, t in nav)
    options = '\n'.join(f'    <option value="#{a}">{o + ". " if o != "·" else ""}{t}</option>' for a, o, t in nav)
    lede_html = f'\n      <p class="lede">{lede}</p>' if lede else ''
    return f'''<!doctype html>
<!-- Generated from {SRC_REL} by docs/harness-docs/build-html.py. Do not edit this file by hand:
     edit the Markdown, then run `python docs/harness-docs/build-html.py`. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>How the QA Harness Works</title>
<meta name="description" content="How the AI Test Harness agent system fits together, with a diagram for each part.">
{fonts}
<style>{style}{EXTRA_CSS}</style>
</head>
<body>

<div class="mobile-bar">
  <select id="mobile-nav" aria-label="Jump to section">
    <option value="#top">Top</option>
{options}
  </select>
  <button class="theme-btn" id="theme-btn-mobile" style="width:auto;margin:0" type="button">THEME</button>
</div>

<div class="shell">

  <aside class="rail">
    <div class="brand">
      <span class="brand-mark">QA</span>
      <span class="brand-name">How It Works</span>
    </div>
    <p class="brand-sub">agents · diagrams · guardrails</p>
    <a class="back" href="index.html">&larr; Back to the handbook</a>

    <nav class="nav" id="nav">
      <div class="nav-group">Sections</div>
{nav_html}
    </nav>

    <button class="theme-btn" id="theme-btn" type="button">&#9680; THEME</button>
  </aside>

  <main class="main">

    <section id="top">
      <p class="eyebrow">How it works</p>
      <h1>{inline(title)}</h1>{lede_html}
{intro}
    </section>

{body}

    <footer class="footer">
      <p>Generated from <a href="harness-docs/ai-qa-harness.md"><code>{SRC_REL}</code></a> by
      <code>docs/harness-docs/build-html.py</code>. Edit the Markdown, then re-run the script. The diagrams&#39;
      editable source is <a href="{DRAWIO}"><code>ai-qa-harness.drawio</code></a>.</p>
    </footer>

  </main>
</div>

<script>{SCRIPT}</script>

</body>
</html>
'''


def main():
    with open(STYLE_FROM, encoding='utf-8') as f:
        index = f.read()
    style = re.search(r'<style>(.*?)</style>', index, re.S)
    fonts = re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>', index)
    if not style:
        sys.exit('build-html: could not find the stylesheet in docs/index.html')
    with open(SRC, encoding='utf-8') as f:
        title, lede, nav, body = convert(f.read())
    first = body.find('<section>')
    intro, rest = (body[:first], body[first:]) if first >= 0 else (body, '')
    out = page(title, lede, nav, (intro.strip(), rest.strip()), style.group(1), '\n'.join(fonts))
    for w in WARNINGS:
        print(f'build-html: warning: {w}', file=sys.stderr)
    if '--check' in sys.argv[1:]:
        current = ''
        if os.path.exists(OUT):
            with open(OUT, encoding='utf-8') as f:
                current = f.read()
        if current != out:
            sys.exit('build-html: docs/how-it-works.html is stale (it differs from what '
                     f'{SRC_REL} produces); run python docs/harness-docs/build-html.py')
        print('build-html: docs/how-it-works.html is up to date')
        return
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print(f'build-html: wrote docs/how-it-works.html ({len(nav)} sections)')


if __name__ == '__main__':
    main()
