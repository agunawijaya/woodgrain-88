# Brief: the Den's Kid setting in the kit

For: engineer.

The full spec is `.team/orders/kit-kid-setting.md`. It was written as an Agy order; Agy hit its quota,
so the work moves here unchanged. Read the order whole and treat it as this brief:

- its front matter `fence` lists the only files you may create or change;
- its `acceptance` commands are the checks to run, from the repo root, before you report;
- the body says what to build and test.

Another engineer is working at the same time in `games/hot-and-cold/` and `hall/`. Adding `kids()`
to `GameSettingsView` will make the Hall and the games fail to compile until a later brief wires
them: that is expected. Do not touch them; list the errors `pnpm exec tsc -p hall/tsconfig.json`
reports that come from your change.

Do not commit, and do not touch the git index.
