

## V3 QA FAIL Remediation — 2026-05-08

Scope: no refactor; only routed QA v2 fail fixes.

- Fixed static metadata Turkish city spelling in four routed HTML files: `İstanbul` / `İzmir` now used in `<title>` and `og:title` surfaces. Files saved as UTF-8.
- Asset 10 PNG verdict-card path now preloads Roboto Regular/Bold, declares Roboto `@font-face`, uses `Roboto, Arial, sans-serif`, and waits on `document.fonts.load()` before canvas paint.
- Updated `fixtures/asset7-test-scenarios.json` stale Test 1 expected net value to `275393.78`.
- Verification note: retained `Arial, sans-serif` as fallback per QA routing while making Roboto the primary canvas font.
