# Final checks report for prompt 03a

## 1. pnpm typecheck

**Result: FAILED**

Command: `pnpm typecheck`

Error output:

```
$ tsc -p tsconfig.json && pnpm -r typecheck
games/hot-and-cold/src/app/controller.ts(686,19): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
[ELIFECYCLE] Command failed with exit code 2.
```

## 2. pnpm test

**Result: PASSED**

Command: `pnpm test`

Output summary:

```
Test Files  119 passed | 3 skipped (122)
     Tests  1021 passed | 15 skipped (1036)
  Start at  01:58:14
  Duration  11.21s (environment 79%, transform 7%, tests 7%, import 6%, worker 1%)
```

Crew tests (`node --test "tools/crew/tests/*.test.mjs"`):

```
# tests 40
# suites 0
# pass 40
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2612.2553
```

## 3. pnpm lint

**Result: FAILED**

Command: `pnpm lint`

Prettier formatting check failed. Code style issues found in 5 files:

- briefs/den-kid-wiring.md
- briefs/hc-integration.md
- briefs/hc-inventory.md
- briefs/hc-inventory.report.md
- briefs/tb-polish-dossier.report.md

## 4. pnpm check

**Result: PASSED**

Command: `pnpm check`

All 8 checks passed:

- ✓ Zero raster outside media folders
- ✓ No original titles or brands in the Hall, packages or games
- ✓ Storage only through the kit store
- ✓ Nothing from original/, src/ or research/ published
- ✓ Open, self-hosted fonts
- ✓ No network URLs in the build
- ✓ Test fixtures and the dev showcase kept out of the build
- ✓ three.js only in game chunks, never in the Hall up front

## 5. pnpm build

**Result: PASSED**

Command: `pnpm build`

Chunk sizes:

**Hall entry chunk:**

- `dist/assets/index-ZfEUdZjz.js`: 396.54 kB raw | 127.64 kB gzip

**Hot & Cold chunk:**

- `dist/assets/module-zl_rExty.js`: 185.85 kB raw | 62.53 kB gzip

**Trailblaze chunk:**

- `dist/assets/module-V8PhhHPu.js`: 212.21 kB raw | 66.77 kB gzip

**Other game chunks also built:**

- Tank Duel: `dist/assets/module-D5_B8BLV.js`: 185.31 kB raw | 61.02 kB gzip

**Shared dependencies:**

- three.js utilities: `dist/assets/BufferGeometryUtils-0rYmGzzx.js`: 648.78 kB raw | 166.90 kB gzip

## 6. HC_BALANCE test

**Result: PASSED**

Command: `HC_BALANCE=1 pnpm exec vitest run --project hot-and-cold games/hot-and-cold/tests/balance.test.ts`

All 7 tests passed:

1. ✓ every field can be solved > never loses the flag and finds it well within 75 checks (still flag, 3,000 fields) [83ms]
2. ✓ every field can be solved > never loses the flag and finds it well within 75 checks (bounce flag, 3,000 fields) [169ms]
3. ✓ every field can be solved > never loses the flag and finds it well within 75 checks (wrap flag, 3,000 fields) [178ms]
4. ✓ hunting alone > takes the perfect hunter a median of 4 to 8 checks on a still flag [0ms]
5. ✓ hunting alone > costs Lou in Classic Memory at most 2 checks more than perfect, at the median [80ms]
6. ✓ the Kids in the race (variation 1, Classic Memory) > lets Lou beat Pip in 75–90% of races to 5 (locked at 72–93% over 900) [4010ms]
7. ✓ the Kids in the race (variation 1, Classic Memory) > lets Moss beat Dee in 50–70% of races to 5 (locked at 47–73% over 900) [5547ms]

Duration: 10.55s
