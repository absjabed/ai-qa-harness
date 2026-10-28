# How to fill this folder

A guide to every file in `setup/` and every folder in `context/sources/`: what goes in, in what format, how
to get it out of the tool it lives in, and what to take out before it goes in. `START-HERE.md` has the order;
this is the detail.

**Who fills what.** One person owns the folder and chases answers; the rest come from whoever knows — the
QA lead, the product owner, whoever administers Jira and the QA environment. Put a name next to anything
still open.

---

## Part 1 — the `setup/` files

### General rules for all of them

- **Keep the tables.** Fill the cells; add rows as needed; don't turn a table into prose.
- **One value per cell.** `2.26`, not "probably 2.26 or 2.27". If two answers are possible, that is an open
  question: write `TBD — <who decides>`.
- **Unknown is a fine answer.** `Don't know — ask <name>` is useful; a guess is not. The context-builder
  treats a guess as fact.
- **Replace the examples.** Rows marked *(example)* show the shape; overwrite or delete them.
- **No secrets, no personal data.** No passwords, tokens, keys, connection strings, phone numbers, home
  addresses — in any file.

### `accounts.md` — test accounts and roles

**Purpose:** decides the **roles** — the kinds of user the tests log in as — and which account plays each.

**How to work out the roles.** List every kind of user {{PROJECT}} has. Two people are the same role if they see
the same menus and may do the same things; they are different roles if one can do something the other cannot.
Aim for the few that differ meaningfully — typically 2 to 6. Ask: who has full access? Who is read-only? Who
approves what others submit?

**Role key format:** camelCase — starts lowercase, letters and digits only, no spaces or dashes:
`admin`, `caseWorker`, `branchManager`, `readOnlyAuditor`. It becomes a file name and a `.env` name, so keep
it short and stable.

**Filled example:**

| Role key | Who it represents | Full access? | Account username / email | Account owner | Password-manager entry |
|---|---|---|---|---|---|
| `admin` | System administrator | yes | `qa.admin@<qa-email-domain>` | QA lead | `{{PROJECT}} QA / admin` |
| `teamLead` | Approves team members' work | no | `qa.teamlead@<qa-email-domain>` | QA lead | `{{PROJECT}} QA / teamLead` |
| `viewer` | Read-only reporting user | no | `qa.viewer@<qa-email-domain>` | QA lead | `{{PROJECT}} QA / viewer` |

**Accounts:** dedicated QA test accounts, created for testing — never a real person's account, never one that
also works in production. One account per role is enough; the tests share it. If accounts do not exist yet,
the "Account owner" column is who will create them.

**Database accounts** — only if the team wants database checks. The agents' account **must be read-only**;
ask a DBA for a login that can `SELECT` and nothing else. The suite's account (for resetting test data) may
write, and is used only by the test runner.

### `jira.md` — the Jira project

**Where to find each answer:**

| Answer | Where |
|---|---|
| Project key | Any ticket ID: `ABC-1234` → `ABC`. Or Jira → the project → *Project settings → Details* |
| Issue key format | The same, with the number: `ABC-1234` |
| A story key that exists | Open any current story; copy its key |
| Connection | Will Claude Code's Atlassian plugin be signed in on the setup machine? If not, plan the CSV export |
| What to digest | The epics or releases the next few months of testing touch — not the whole project. A JQL like `project = ABC AND fixVersion in (2.25, 2.26)` works too |
| Release naming | Jira → the project → *Releases*: the version names, exactly as written |
| Bug issue type | Open any existing bug and read its issue type: `Bug`, `Defect`, … |
| Priority and severity | The same bug: its Priority values, and whether a Severity field exists and its values |

### `decisions.md` — environment, scope, severity, exit criteria

**Environment:** the full address of the QA or staging site, as you would type it in a browser, with
`https://` and no trailing slash: `https://<qa-host>`. Not production, ever.

**Areas to stay out of:** be specific — the screen or menu, and why: *"Admin → Payments → Run batch — opening
it starts a batch"*, *"Integrations — shared with another team's tests"*.

**Severity rubric:** one line of meaning and **one real {{PROJECT}} example** per level — the example is what
makes it usable:

| Severity | Means | Example from {{PROJECT}} |
|---|---|---|
| P1 Critical | Data lost or corrupted, or a core task impossible with no workaround | *(a real past bug)* |
| P2 Major | Core task wrong or blocked, but a workaround exists | |
| P3 Minor | Secondary feature wrong; annoying, not blocking | |
| P4 Low | Cosmetic — text, alignment, typo | |

If {{PROJECT}} already has a severity definition (a QA plan, a Jira field description), copy its wording.

**Exit criteria:** keep the defaults unless the team already agrees different numbers.

### `contacts.md` — who to ask

One row per area of {{PROJECT}} — the menus or modules — and the person who knows its rules best. Names and job
roles only. The second table is for practical questions: accounts, the environment, data, Jira, database.

### `paths.md` — local paths (optional)

Only if the team has these on the setup machine: a checkout of {{PROJECT}}'s source, an OpenAPI/Swagger file,
schema scripts. Full paths: `<path-to>/{{SLUG}}-source`. Also the path to any document that must not be committed —
it can be read from where it is.

### `checklist.md`

Tick a box only when it is really done. Part A before setup day; B and C on the day.

---

## Part 2 — the `context/sources/` folders

### What the context-builder does with them

It reads each document and **distils** it: the business rules go into `context/<area>.md`, each citing its
source — *"document, section"* or *"ticket key"*; existing test cases become a summary of what is already
covered; bug history becomes the areas to test hardest. It does not copy documents. Where a document and the
running application disagree, it records the difference for a person to settle.

So: **a short, current, specific document beats a long, old, general one.** Ten pages of the rules for one
area are worth more than a 300-page manual.

### Formats

| Best | Fine | Convert first | Avoid |
|---|---|---|---|
| Markdown, plain text, CSV | PDF with real text | Word → PDF; Excel → CSV; PowerPoint → PDF | Scanned images, screenshots of text, password-protected files, zip archives |

- **CSV:** save as *CSV UTF-8*, one header row, one record per row, no merged cells, no blank rows at the top.
  One sheet per file — split a workbook into one CSV per sheet.
- **PDF:** must have selectable text; a scanned PDF reads as nothing.
- **Size:** keep a single file under ~20 MB; split a huge export by area or release.

### File names

`<area>-<what>-<yyyy-mm>.<ext>` — lowercase, dashes, no spaces:

```
specs/billing-business-rules-2026-09.pdf
specs/user-roles-and-permissions-2026-08.md
test-cases/billing-regression-cases-2026-10.csv
defects/open-and-recent-bugs-2026-10.csv
jira/release-2.26-stories-2026-10.csv
guides/user-guide-v4-2026-06.pdf
guides/glossary-2026-10.md
```

The area and the date tell the context-builder what the document covers and how current it is.

### Before anything goes in — take out

- **Personal data:** real customer or patient names, emails, phone numbers, addresses, IDs. Replace with
  placeholders or delete the column.
- **Credentials:** passwords, tokens, API keys, connection strings — including inside screenshots in a PDF.
- **Production extracts:** real data exported from the live system. QA-environment data only.
- **Confidential material the whole team may not see.** It is committed with the QA repo; keep it outside
  and put its path in `paths.md`.

### `specs/` — specifications and business rules

**Put here:** functional specifications, business-rule documents, requirement documents, Confluence or wiki
pages describing how {{PROJECT}} should behave — rules, calculations, validations, states (*draft → submitted →
approved*), who may do what.

**How to export:** Confluence → the page's *⋯* menu → *Export → PDF* (or *Word*, then save as PDF). A whole
Confluence space: export only the pages for the areas being tested. Word → *File → Save as → PDF*.

**Best:** current documents, one area per file. Mark superseded ones in the file name (`-superseded`) or leave
them out.

### `test-cases/` — existing test cases

**Put here:** manual test cases from spreadsheets or a test-management tool, and the list of cases of any
older automated suite — not its code.

**How to export:** a spreadsheet → *Save as CSV UTF-8*. A test-management tool → its export to CSV, for the
areas being tested. An automated suite → a list of its test names and what each checks.

**Columns that help** — keep whichever exist, any names:

```
ID, Title, Area/Module, Preconditions, Steps, Expected Result, Priority, Type (Manual/Automated), Linked story
```

**Example rows:**

```csv
ID,Title,Area,Preconditions,Steps,Expected Result,Priority,Type,Linked story
TC-101,Submit a timesheet,Timesheets,Logged in as employee,"1. Open Timesheets 2. Fill week 3. Submit",Status shows Submitted,High,Manual,ABC-412
TC-102,Reject without a reason,Timesheets,A submitted timesheet,"1. Open as teamLead 2. Click Reject",Error: A reason is required,Medium,Manual,ABC-418
```

The old IDs are kept for reference; the harness gives every case it carries forward a new ID tied to its Jira
story.

### `defects/` — bug history

**Put here:** recent and open bugs, and any list of known problem areas.

**How to export:** Jira → *Filters → Advanced search*, e.g.
`project = ABC AND issuetype = Bug AND created >= -12M ORDER BY created DESC` → *Export → CSV (current
fields)*. Choose the columns first:

```
Key, Summary, Status, Priority, Severity, Component/Area, Created, Resolution, Description
```

A short Markdown note of known weak spots is welcome too: *"Billing rounding breaks on refunds over 1,000"*.

### `jira/` — stories and epics, only if Jira will not be connected

**Skip this folder if** the Atlassian plugin will be signed in on setup day — the context-builder reads Jira
directly and asks which epics or releases to digest (`jira.md`).

**Otherwise:** Jira → *Advanced search* for the epics and stories to digest, e.g.
`project = ABC AND fixVersion in (2.25, 2.26) AND issuetype in (Story, Epic)` → *Export → CSV (current
fields)*, with these columns shown first:

```
Key, Summary, Issue Type, Status, Fix Version, Epic Link / Parent, Description, Acceptance Criteria
```

Acceptance criteria are often inside the description or a custom field — make sure whichever holds them is in
the export. One file per release or epic.

### `guides/` — user guides, release notes, glossary

**Put here:** end-user guides, help pages, training material, release notes, and a glossary of {{PROJECT}}'s
business terms. These teach the harness the **vocabulary** the business uses, so plans and tests say what the
users say.

**A glossary is worth making** if none exists — a Markdown table is enough:

```markdown
| Term | Meaning |
|---|---|
| Timesheet | A week of hours one employee submits for approval |
| Approval chain | The people a submission passes through, in order |
```

---

## Done when

- [ ] Every `setup/` file filled, open items marked `TBD — <who>`
- [ ] Each `context/sources/` folder has what the team has, or is knowingly empty
- [ ] Every document checked for personal data, credentials and production extracts
- [ ] `checklist.md` part A ticked
