# V8.2 Notes — Date Input Mobile Regression + Roboto Path Wiring

Applied on top of v8.1.

## Fixes

1. **Asset 7 date inputs auto-insert slashes**
   - File: `assets/asset7/asset7.js`
   - User can type `08052021`; the field formats live to `08/05/2021`.
   - Existing validation still accepts Turkish `gg/aa/yyyy` and normalizes internally to ISO (`yyyy-mm-dd`) before the calc engine receives dates.
   - The fields remain `type="text"` with `inputmode="numeric"`, so iPhone users get the numeric keyboard and do not need to type slashes manually. Validation now accepts both raw `08052021` and formatted `08/05/2021` input.

2. **Date input guardrails**
   - File: `assets/asset7/kidem-tazminati-hesaplama.html`
   - Added `maxlength="10"` to the start/end date fields to match `gg/aa/yyyy` length.

3. **Roboto/jsPDF delivery contract**
   - `vendor/jspdf.umd.min.js` remains bundled.
   - Existing jsPDF adapter font resolution remains pointed at `/assets/fonts/` and relative fallback paths.
   - `assets/fonts/Roboto-Regular.ttf` and `assets/fonts/Roboto-Bold.ttf` are the required deployment paths for the project font binaries.

## Validation

Run:

```bash
node --check assets/asset7/asset7.js
node --check assets/asset10/asset10.js
node --check shared/js/asset7-pdf-adapter.js
node --check shared/js/config-loader.js
node --check shared/js/analytics.js
node tests/asset7-calc-engine-v5.test.js
node tests/v6-polish-regression.test.js
node tests/v7-batch-regression.test.js
node tests/v8-batch-regression.test.js
node tests/v8-1-followup-regression.test.js
node tests/v8-2-date-font-regression.test.js
```

Expected: all PASS. This package preserves the Roboto paths and deployment note; `vendor/jspdf.umd.min.js` is bundled at the required path. The deployable zip is canonical for all non-font binaries.

## Additional v8.2 dropdown correctness fix

- Hardened Asset 10 province dropdown rendering so popular entries and A-Z entries are both bound to the same canonical province slug (`istanbul`, `ankara`, `izmir`).
- Replaced any possibility of index-based duplicate-option mapping with a single `provinceOption()` renderer.
- Sorted the A-Z optgroup with Turkish locale ordering at render time.
- Added a regression test covering İstanbul/Nisan, Ankara/Ocak, and İzmir/Aralık from both dropdown positions.
