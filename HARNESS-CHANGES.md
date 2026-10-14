# Harness changes in this QA repo

Every change this QA repo makes to its own copy of the harness — an agent's instructions, the templates, the
guard rails, the scripts — with why it was made and how to check it. `/playwright-harness-improver` writes an
entry for each change it makes, and for each problem the team only wants noted. Add one yourself if you
change a harness file by hand.

It answers the questions that come up later: why does this copy behave differently from the template, did
that fix actually work, and which of our changes would help other projects too. Project facts — roles,
rules, data, the profile's own content — are not harness changes; they change all the time and live in
`PROJECT-PROFILE.md` and `context/`.

Newest first. Each entry:

```markdown
## <YYYY-MM-DD> — <one-line summary>

- **Problem:** <what happened, what was expected>
- **Cause:** <the layer and file, and why>
- **Change:** <what changed, in which files — docs included>
- **Check:** <how to confirm it; and once someone has, the date and result>
- **Status:** applied · verified · reverted · noted
- **Upstream:** yes — <why it would help any project> · no — <why it is this project's own>
- **Protections:** none · <which protection changed, and who agreed>
```

---

_No changes yet._
