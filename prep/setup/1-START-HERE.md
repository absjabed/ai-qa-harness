# {{PROJECT}} QA — setup prep

> **You are here: 1 of 3 — read this first.** Then open `2-CHECKLIST.md` and work from it.
> `3-FILLING-GUIDE.md` is for looking things up while you fill a file.

This folder will become the {{PROJECT}} QA repository. Before setup day, fill in the files in `setup/` and drop
the project's documents into `context/sources/`. On setup day the QA harness is exported straight into this
folder; nothing here needs moving, and the export never overwrites these files.

## The three numbered files — how they fit together

| File | Its job | How to use it |
|---|---|---|
| **`1-START-HERE.md`** — this page | The map: what this folder is, where each thing goes, the rules | Read once, start to finish — five minutes |
| **`2-CHECKLIST.md`** | The work, in order | Work from it the whole time. Each item says which file to fill and which section of the guide helps. Tick it when done |
| **`3-FILLING-GUIDE.md`** | The detail — how to answer, examples, how to export documents, formats, what to remove | **Don't read it front to back.** Open it at the section for the file you are filling |

The other files in `setup/` — `accounts.md`, `jira.md`, `decisions.md`, `contacts.md`, `paths.md` — are the
ones you fill in. The checklist sends you to each in turn.

## The order

1. **Read this page.**
2. **Open `2-CHECKLIST.md` and work through part A, top to bottom.** For each item, open the file it names,
   fill it in, and keep `3-FILLING-GUIDE.md` open at that file's section beside it. Documents go into
   `context/sources/` — the table below says which subfolder.
3. **When part A is all ticked, it is setup day.** Get a local copy of the `ai-qa-harness` template repository — ask whoever maintains it for
   access and its location — and export it into this folder:

   ```bash
   cd ai-qa-harness
   npm run export -- <path-to>/{{FOLDER}}
   ```

   `<path-to>/{{FOLDER}}` is wherever this folder sits on the setup machine — for example
   `../{{FOLDER}}` if the two folders are side by side. The export copies the harness into it and leaves
   `setup/` and `context/sources/` exactly as they are.

   then, in this folder:

   ```bash
   git init
   npm install
   npx playwright install
   ```

   and follow `docs/NEW-QA-REPO.md` (it arrives with the export), using these files as your answers. Work
   through `2-CHECKLIST.md` part B, run `/playwright-context-builder`, then part C.

## Where to put what

### Files to fill in — `setup/`

| File | What goes in it | Where it ends up on setup day |
|---|---|---|
| `2-CHECKLIST.md` | Tick boxes for everything below, in the order it is needed | Stays here as the record of the setup |
| `accounts.md` | One row per **kind of user**: role key, who it represents, full access or not, who owns the account, the password-manager entry it lives in. **Never the password itself** | Role keys → `config/projectProfile.ts` and `PROJECT-PROFILE.md` section 2; one login file each in `tests/seeds/`; the passwords typed into `.env` from the password manager |
| `jira.md` | Project key, issue key format, one story key you know exists, which epics or releases to digest, the bug issue type and its priority / severity fields | `.env` (`TRACKER_PROJECT_KEY`), `PROJECT-PROFILE.md` sections 1 and 7, the context-builder's Jira questions |
| `decisions.md` | Environment, areas to stay out of, severity rubric, what is in scope, release naming, exit criteria | `PROJECT-PROFILE.md` sections 5, 6, 7, 8 and 10, and `exitCriteria` in `config/projectProfile.ts` |
| `contacts.md` | Who to ask about which area of {{PROJECT}} | The context-builder's inventory question "who to ask about what" |
| `paths.md` | Local paths to the application's source, API docs, schema scripts — only if the team has them — and to any document too large or confidential to put in `context/sources/` | Answers to the context-builder's inventory step |

### Documents — `context/sources/`

| Subfolder | Put here | Format |
|---|---|---|
| `context/sources/specs/` | Functional specifications, business-rule documents, Confluence or wiki pages | PDF or Markdown — save Word as PDF |
| `context/sources/test-cases/` | Existing test cases — spreadsheets, test-tool exports, the case list of an older automated suite | CSV |
| `context/sources/defects/` | The bug list, known problem areas | CSV |
| `context/sources/jira/` | Only if Jira will **not** be connected: the epics and stories to digest, from a Jira filter or search → *Export* → CSV, with the description and acceptance-criteria columns | CSV |
| `context/sources/guides/` | User guides, release notes, a glossary of business terms | PDF, Markdown or text |

Everything in `context/sources/` is committed with the QA repo, so the whole team works from the same
documents. A document too large or too confidential to commit stays outside this folder — write its path in
`setup/paths.md` instead. The `.gitkeep` files only keep the empty folders; leave them or delete them.

## Rules for everything in this folder

- **No passwords, tokens or keys** anywhere in `setup/` or `context/sources/`. Passwords live in the team's
  password manager until setup day, then only in `.env`, which is never committed.
- **No personal data and no production extracts.** Test cases and bug lists from the QA environment only.
- **Dedicated QA test accounts only** — never a person's own account, never one that works in production.
- **QA or staging only** — the harness is never pointed at production.
