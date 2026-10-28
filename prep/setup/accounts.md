# {{PROJECT}} — test accounts and roles

**No passwords in this file — ever.** Write where each password lives (the password-manager entry); the
passwords themselves go into `.env` on setup day and nowhere else.

## Roles

One row per **kind of user** — one per distinct set of permissions the tests need, not one per person.
The role key is camelCase: letters and digits, starting lowercase, no spaces.

| Role key | Who it represents | Full access? | Account username / email | Account owner | Password-manager entry |
|---|---|---|---|---|---|
| `admin` *(example — replace)* | System administrator | yes | `qa.admin@…` | Name | `{{PROJECT}} QA / admin` |
| `<roleKey>` | | no | | | |
| `<roleKey>` | | no | | | |

**Baseline role** — the one with full access, which every other role is compared against: `<roleKey>`

On setup day each role key becomes:

| Where | What |
|---|---|
| `config/projectProfile.ts` | `export const roles = ['admin', '<roleKey>', …] as const;` and `baselineRole: '<baseline>'` |
| `PROJECT-PROFILE.md` section 2 | One row per role |
| `.env` | `<ROLE>_EMAIL` and `<ROLE>_PASSWORD` — the key in capitals, `_` where a capital starts a word: `caseWorker` → `CASE_WORKER_EMAIL`, `CASE_WORKER_PASSWORD` |
| `tests/seeds/<roleKey>.spec.ts` | One login file per role |

The context-builder can do all four with you — have this table open when it asks.

## Database accounts (optional)

| Purpose | Server / database | Account | Read-only? | Password-manager entry |
|---|---|---|---|---|
| Agents — inspect the schema and data | | | **must be read-only** | |
| Suite — seed and reset test data | | | no | |

QA or staging databases only, never production.
