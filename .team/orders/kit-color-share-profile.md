---
id: kit-color-share-profile
kind: engine
fence:
  - packages/kit/src/color.ts
  - packages/kit/src/share.ts
  - packages/kit/src/profile.ts
  - packages/kit/tests/color.test.ts
  - packages/kit/tests/share.test.ts
  - packages/kit/tests/profile.test.ts
acceptance:
  - pnpm exec vitest run packages/kit/tests/color.test.ts packages/kit/tests/share.test.ts packages/kit/tests/profile.test.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec eslint packages/kit/src/color.ts packages/kit/src/share.ts packages/kit/src/profile.ts packages/kit/tests/color.test.ts packages/kit/tests/share.test.ts packages/kit/tests/profile.test.ts
  - pnpm exec prettier --check packages/kit/src/color.ts packages/kit/src/share.ts packages/kit/src/profile.ts packages/kit/tests
reads:
  - packages/kit/src/color.ts
  - packages/kit/src/share.ts
  - packages/kit/src/profile.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/types.ts
---

## Goal

Implement colour maths, challenge links with share cards, and the profile stub behind the
signatures the lead wrote in `color.ts`, `share.ts` and `profile.ts`, with tests.

## Context

- Replace each `export declare function` with an implementation; keep every exported name,
  signature, type and doc comment exactly. Private helpers are fine.
- No network, no images, no external fonts: the share card is pure SVG text.
- `profile.ts` uses a `Repository<ProfileData>`; the store is implemented by a parallel order, so
  in tests build a tiny in-memory repository inside the test file.
- Strict TypeScript and strict type-checked ESLint (no `any`, no `!`). Vitest with happy-dom.

## Interface to implement

The declarations in `color.ts`, `share.ts` and `profile.ts`.

## Behaviour and edge cases

Colour:

1. `parseColor` handles `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r, g, b, a)` (comma or
   space separated, percentages allowed), `hsl(h, s%, l%)` and `hsla`. Case-insensitive, whitespace
   tolerant. Throws `Error("Cannot read colour: <input>")` otherwise.
2. `relativeLuminance` and `contrastRatio` follow WCAG 2.x exactly (sRGB linearisation with the
   0.04045 threshold). Black on white is 21; a colour on itself is 1.
3. `mix` clamps t to [0, 1] and rounds channels. `withAlpha` clamps alpha to [0, 1].
4. `ensureContrast` returns the input if it passes; otherwise it steps lightness towards white
   when `against` is dark (luminance < 0.5) and towards black otherwise, in small steps, returning
   the first passing colour; if even white/black fails, return white/black.

Share: 5. The canonical form for the checksum is `${game}|${channel}|${seed}|${score}`. The checksum is a
32-bit FNV-1a of `"woodgrain-88/challenge/" + canonical`, rendered in base 36, padded with
leading zeros and cut to the last six characters. 6. `encodeChallenge` builds exactly `#/play/<game>?mode=challenge&ch=<channel>&seed=<seed>&beat=<score>&sig=<checksum>`
with values URI-encoded. 7. `decodeChallenge` accepts the string with or without `#`, requires the `#/play/<id>` path,
`mode=challenge`, all four parameters, kebab-case game and channel ids, an integer seed in
0–4294967295, a finite score within ±1e9 (integers or decimals), and a matching checksum;
otherwise null. Extra parameters are ignored. 8. `renderShareCard` returns a string starting with `<svg` and containing `width="1200"`,
`height="630"` and `viewBox="0 0 1200 630"`, with all text XML-escaped (`& < > " '`). Light and
dark use different, deliberately chosen backgrounds (light: warm cream paper with a walnut
woodgrain band; dark: deep blue-brown with a warm glow) — draw the woodgrain with a few
curved `<path>` strokes, not an image. Include the emblem as a `<path d="...">` scaled from
24×24 when given, the title, the subtitle, up to four lines, and the text "Woodgrain '88". Use
`font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"`. No `<image>`, no `href` to
anything, no `url(` except to gradients defined in the same SVG. 9. `copyText` uses `navigator.clipboard.writeText` and returns false on any failure or when the
API is missing. `downloadText` creates a Blob, an object URL and a temporary `<a download>`,
clicks it, then revokes the URL.

Profile: 10. `validateDisplayName`: trim, collapse inner whitespace runs to one space; reject empty or
longer than `DISPLAY_NAME_MAX` with "Pick a name with 1 to 20 characters."; reject control
characters with "Letters, numbers and spaces work best."; reject deny-listed words with
"Let's pick a different name.". The deny-list is a short private array of common English
profanity stored ROT13-encoded (decode at module load) so the source does not spell them out;
matching lowercases, strips spaces and punctuation, and maps 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a,
$→s before checking whether any listed word appears as a substring. 11. `randomAvatar` picks hue as an integer 0–359 and a shape and pattern from the allowed values
using the given `Rng`. 12. `createProfile`: `get` returns the repository data; `rename` validates and, when ok, updates
`displayName`; `setAvatar` updates the avatar with hue wrapped into 0–359.

## Tests required

Written first: parsing of every accepted form and rejection of garbage; WCAG reference values
(black/white 21, #777 on white ≈ 4.48, AA pass/fail cases for normal and large text);
`ensureContrast` reaching 4.5 against dark and light backgrounds; checksum stability (a fixed
challenge always gives the same six characters); encode → decode round trip; decode returns null
for a changed score, a changed seed, a missing parameter, a bad id, an out-of-range seed and a
wrong path; the share card contains escaped text (title with `&` and `<`), no `<image`, and differs
between light and dark; display-name rules including whitespace collapsing, the 20-character
limit, a deny-listed word disguised with digits and punctuation, and a normal name with an
accidental substring that must still pass if it is a real word (choose your list so that "Scunthorpe"
and "Cassandra" pass); `randomAvatar` is deterministic for a seeded `Rng`.

## Out of scope

UI, clipboard permissions UX, anything outside the fence.
