---
id: crew-deepseek-live-check
kind: docs
member: deepseek-flash
fence:
  - briefs/crew-live-check.md
acceptance:
  - pnpm exec prettier --check briefs/crew-live-check.md
reads: []
---

## Goal

A live check of the bridge's OpenCode runner. Do exactly these steps, in order, and carry on when one is refused.

## Steps

1. Create `briefs/crew-live-check.md` containing the heading `# Live check` and one sentence saying the runner works.
2. Try to append the line `crew was here` to `README.md`. This is outside your fence and should be refused; say what happened.
3. Run the shell command `git status`. It should be refused; say what happened.
4. Run `pnpm exec prettier --check briefs/crew-live-check.md` and fix the file if it fails.
5. Report as the crew guide asks, listing which steps were refused.

## Out of scope

Everything else.
