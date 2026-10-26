---
id: versions-tests
kind: tests
model: gemini-3.8-flash-high
fence:
  - packages/kit/tests/versions.test.ts
  - packages/kit/tests/contract.test.ts
  - packages/kit/tests/share.test.ts
  - packages/kit/tests/store-schema.test.ts
  - hall/tests/cycle.test.ts
  - hall/tests/run-info.test.ts
  - hall/tests/router.test.ts
  - hall/e2e/harness/versions.spec.ts
  - hall/e2e/site/versions.spec.ts
acceptance:
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec tsc -p hall/tsconfig.json
  - pnpm exec tsc -p hall/e2e/tsconfig.json
  - pnpm exec vitest run --project kit --project hall
  - pnpm exec eslint packages/kit/tests hall/tests hall/e2e
  - pnpm exec prettier --check packages/kit/tests hall/tests hall/e2e
  - pnpm exec playwright test hall/e2e/harness/versions.spec.ts hall/e2e/site/versions.spec.ts
reads:
  - packages/kit/src/versions.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/share.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/store/types.ts
  - hall/src/data/cycle.ts
  - hall/src/data/registry.ts
  - hall/src/data/coming-soon/lane-hopper.ts
  - hall/src/data/coming-soon/pier-derby.ts
  - hall/src/play/run-info.ts
  - hall/src/play/session.ts
  - hall/src/routes/router.ts
  - hall/src/chrome/version-picker.ts
  - hall/src/chrome/details.ts
  - hall/src/chrome/settings-panel.ts
  - hall/src/den/den-view.ts
  - hall/src/den/game-card.ts
  - hall/tests/fixtures/fake-game.ts
  - hall/e2e/helpers.ts
  - hall/e2e/harness/play-loop.spec.ts
  - hall/e2e/harness/challenge.spec.ts
  - hall/e2e/site/data.spec.ts
  - packages/kit/tests/share.test.ts
  - packages/kit/tests/store-schema.test.ts
---

## Goal

Tests for cartridge versions, which replaced the old hidden-reskin "secrets" today. A merged game
(Lane Hopper, Pier Derby) declares two versions. The player picks one, the pick is saved per game,
the Hall hands it to the game in `run.version`, and finishing a run with a version lights its
Counter lamp. The code is written and working; the job is to pin its behaviour down.

## Context

- Kit: `packages/kit/src/versions.ts` (`VERSION_SETTING`, `defaultVersion`, `alternateVersions`,
  `findVersion`, `resolveVersion`) and the `CartridgeVersion` rules in `validateManifest` and
  `validateRegistry` (`packages/kit/src/contract.ts`, function `versionProblems`).
- Kit share: a `Challenge` may carry `version`. It is encoded as `&ver=<id>` and signed into the
  checksum only when present, so links made without a version still verify.
- Kit store: the progress schema is now version 2. `GameProgressData.secretsFound` became
  `versionsFinished` (version id → ISO time). The v1 → v2 migration drops `secretsFound` and adds an
  empty `versionsFinished`. `emptyGameProgress()` returns a blank game entry.
- Hall data: `counterPlaces(manifests)` in `hall/src/data/cycle.ts` gives places 1–30 (each game in
  its default version) plus 31 and 32 (the other versions, in slot order). `placeFinished(place,
progress, plays)` decides whether a lamp is lit.
- Hall run: `runFromParams(manifest, params, hash, now, savedVersion)` picks the version in this
  order: the challenge's version, then `?version=` on the route, then the saved choice, then the
  default. A game without versions gets no `version`. Unknown ids fall through to the next candidate.
- Hall routes: `#/game/<id>?version=<id>` parses to `{ name: 'game', id, version }`. A version that
  is not kebab-case is dropped, and `routeHash` round-trips the route.
- The fake game (`hall/tests/fixtures/fake-game.ts`) declares two versions: `standard` (default) and
  `tall`. The harness (`/harness.html` on the dev server, project `harness`) puts it in slot 11, so
  Counter place 31 is the fake game's `tall` version. Its canvas `.fake-game-canvas` has
  `data-version` set to the version it was handed.
- UI hooks:
  - The Den card is `.game-card`: kicker `.game-card-kicker` (for example
    "CH 31 · Duels · Tall paddles version"), buttons `button[data-action="play"]` and
    `button[data-action="details"]`.
  - The power switch: `P` steps forward and `Shift+P` steps back. From the starting place,
    Shift+P twice lands on 31; read the digits with `counterText` from `hall/e2e/helpers.ts`.
  - Counter lamps are `[data-ref="counter-lamps"] .lamp[data-slot="N"]`, lit when they have class
    `is-played`. Hovering `.lamp-hit[data-slot="N"]` fills `.den-tooltip`.
  - The version picker: radios `input[name="cartridgeVersion"]`, inside `.details-versions` on the
    details dialog `.dialog--details`, and in the first section of `.dialog--settings` when the
    settings panel is opened from the pause menu inside a game.
  - Saved choices live in `localStorage['wg88:settings']` under `data.games[<id>].cartridgeVersion`.
    Tests may read storage; only shipped code may not.
- Follow the patterns in the existing specs under `reads` (`skipIntro`, `collectErrors`, how
  play-loop drives the fake game to its results, `expect(errors).toEqual([])` at the end).

## Behaviour and edge cases

Kit (`packages/kit/tests/versions.test.ts`, plus additions to `contract.test.ts`, `share.test.ts`
and `store-schema.test.ts`; create `contract.test.ts` if it does not exist):

1. `defaultVersion` returns the first version, or undefined. `alternateVersions` returns the rest,
   or an empty list.
2. `resolveVersion` returns the first declared candidate and skips unknown, null and undefined
   ones. It falls back to the default, and returns undefined for a game without versions.
3. `validateManifest` reports each of these: fewer than two versions, a non-kebab id, a duplicate
   id, a label of 0 or more than 24 characters, a description of 0 or more than 140 characters, a
   `cartridgeSlot` not in `inspiredBy.cartridgeSlots`, and two versions on the same cartridge slot.
   A valid manifest with versions has no problems.
4. `validateRegistry` reports two games claiming the same version cartridge slot.
5. A challenge with a version encodes `&ver=` and decodes back to it. Changing `ver` in the link
   fails verification. A challenge without a version decodes without one, and its link and
   checksum are exactly what they were before versions existed (compute the expected checksum
   from the canonical text `game|channel|seed|score`).
6. `upgrade('progress', { v: 1, data })` where a game has `secretsFound` gives v2 data with
   `versionsFinished: {}` and no `secretsFound`. Sanitising v2 data drops non-string or empty
   `versionsFinished` times.

Hall (vitest):

7. `counterPlaces` on the base registry: places 1–32 in order. Lane Hopper's `chicken` is on 11,
   Pier Derby's `derby` on 15, `rabbit` on 31, `hack` on 32. With the fake game overridden into
   slot 11, place 31 is `test-paddles`/`tall` and 32 is still `pier-derby`/`hack`.
8. `placeFinished`: a version place is lit only by its own `versionsFinished` entry (the other
   version's entry does not light it). A game without versions is lit once plays > 0.
9. `runFromParams` follows the order above for normal, daily and challenge runs, ignores an unknown
   `?version=`, and sets no `version` for a game without versions.
10. Router: `#/game/lane-hopper?version=rabbit` parses and hashes back the same. `?version=Not_Ok`
    is dropped.

End to end:

11. Harness (`hall/e2e/harness/versions.spec.ts`): from the Den, go to place 31. The card's kicker
    names the "Tall paddles" version. Play from the card. The fake game's canvas reports
    `data-version="tall"`. Drive the game to its results the way play-loop does, then go Back to
    the Hall. Lamp 31 now has `is-played`, and hovering its cell shows a tooltip ending in
    "finished".
12. Harness: open the pause menu's Settings during a run, pick `standard`, close, quit to the
    Hall. Reopen the game from its Label Wall cartridge (slot 11) via the card. The canvas reports
    `data-version="standard"` and storage holds `cartridgeVersion: 'standard'`.
13. Site (`hall/e2e/site/versions.spec.ts`): open `/#/game/lane-hopper` and pick Rabbit in the
    details overlay. Storage now holds `rabbit`. After a reload the Rabbit radio is checked. Then
    on the Den, place 31's card kicker says "Rabbit version", and hovering lamp 31 shows a tooltip
    naming "Lane Hopper, Rabbit version".

## Tests required

All of the above, one `it`/`test` per numbered behaviour, named by what it proves. Keep every
existing test passing and do not loosen any existing assertion.

## Out of scope

Any source file outside `tests/` and `e2e/`. If something looks like a bug in the shipped code,
describe it in your report instead of working round it.
