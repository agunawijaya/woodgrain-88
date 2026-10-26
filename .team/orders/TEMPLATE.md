---
id: NNNN-short-name # must equal the file name without .md
kind: engine # engine | ai | dossier | tests | docs | data | plumbing
# model: gemini-4-argon-medium   # optional; gemini-* only, defaults by kind
fence:
  - packages/kit/src/example.ts
  - packages/kit/tests/example.test.ts
acceptance:
  - pnpm vitest run packages/kit/tests/example.test.ts
  - pnpm exec eslint packages/kit/src/example.ts packages/kit/tests/example.test.ts
reads:
  - packages/kit/src/index.ts
---

## Goal

One or two sentences: what exists when this order is done, and why it matters.

## Context

What the crew needs to know that is not in the files it reads: where this fits, which decisions are
already made, which neighbouring modules it must agree with.

## Interface to implement

The exact TypeScript signatures, written by the lead. The crew implements them and does not change
them; if one looks wrong, it says so in its report.

```ts
export interface Example {
  /** What it does and why. */
  run(input: number): number;
}
```

## Behaviour and edge cases

Numbered, testable statements. Include the awkward cases: empty input, wrap-around, ties, limits.

1. ...

## Tests required

The tests to write first, one line each, named by the behaviour they prove.

- ...

## Out of scope

What not to touch or build, so the crew does not wander.
