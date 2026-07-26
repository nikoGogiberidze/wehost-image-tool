## What this changes

<!-- What does this do, and why? Link an issue if there is one. -->

## How it was verified

<!--
CI runs lint, unit tests, build and E2E. Beyond that, say what you actually
checked by hand — especially for image-processing changes, where "the tests
pass" and "the output looks right" are not the same claim.
-->

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build && npm run test:e2e`
- [ ] Ran the app and confirmed the change by eye

## Anything reviewers should know

<!--
Trade-offs, things you weren't sure about, or follow-up work you deliberately
left out of scope.
-->

---

- [ ] If I changed watermark placement maths, it went in `shared/geometry.mjs` with a unit test — not into `main.js` or a component (see [CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] If I touched the processing pipeline, full-resolution image bytes still do not cross IPC into the renderer
