# V7 Notes — Polish + Tax Display Batch

Build base: v6 full-site bundle (v5 calc engine hotfix plus v6 polish preserved). v7 absorbs and extends the v6 changes.

## Applied fixes

1. **Asset 7 leap-day/anniversary calculation**
   - Added anniversary-aware tenure logic in `assets/asset7/asset7.js`.
   - Same calendar day/month across whole years now uses exact whole-year multiplier.
   - Repro: `2021-05-08 → 2026-05-08` produces brüt `277,500.00` and net `275,393.78`.
   - Non-anniversary dates still use exact day-count prorating.

2. **Asset 7 Evlilik + Erkek immediate ineligibility**
   - Selecting `Evlilik` + `Erkek` immediately renders the ineligibility verdict.
   - Downstream fields and submit button are collapsed until the user changes the selection.

3. **Asset 7 gender selector cleanup**
   - Removed `Cinsiyet belirtmek istemiyorum` from the marriage-clause gender dropdown.
   - Gender remains hidden outside `Evlilik`.

4. **Asset 7 Evlilik 1-year disclosure**
   - Added formal disclosure shown only when `Evlilik` + `Kadın` is selected.

5. **Asset 7 tavan history period format**
   - Tavan history render layer converts `I. Yarı` → `1. Yarı` and `II. Yarı` → `2. Yarı`.
   - `data/asset7.json` was not modified.

6. **Asset 7 tavan history intro copy**
   - Removed developer placeholder text from `kidem-tazminati-tavani-tarihi.html`.
   - Replaced with user-facing intro copy.

7. **Asset 10 full-bill-flip warning copy**
   - Updated warning to clarify `Aylık kademe sınırından` one sm³ over.
   - Applied in `data/asset10.json`; render surfaces continue reading from JSON.

8. **Asset 7 Turkish date input UX**
   - Replaced browser-locale `type="date"` fields with text inputs using `gg/aa/yyyy` placeholder.
   - Added dd/mm/yyyy parsing and validation while still accepting ISO dates internally/tests.

9. **Placeholder pages converted to Yapım aşamasında panels**
   - Updated five Asset 7 placeholder pages and four Asset 10 placeholder pages.
   - Kept page titles/meta/header structure and added calculator CTA.

10. **Asset 10 tax-inclusive verdict/card display**
    - Added `pricing.kdv_rate`, `pricing.kdv_effective_from`, `pricing.otv_per_sm3`, `pricing.otv_effective_from`, and `pricing.tax_source_citation` to `data/asset10.json`.
    - Confirmed ÖTV effective date used: `2025-12-31`.
    - Formula: `consumption_sm3 × ((selected_unit_price + otv_per_sm3) × (1 + kdv_rate))`.
    - Added `KDV ve ÖTV dahil tahmini fatura` line to on-page result and PNG card.
    - Updated KDV/ÖTV disclaimer string.

11. **Root index.html**
    - Added minimal root page linking to Asset 7 and Asset 10 calculators.

12. **v6 preservation check**
    - Added v7 regression test confirming all v6 polish behavior remains present.

## Validation

```bash
node --check assets/asset7/asset7.js
node --check assets/asset10/asset10.js
node --check shared/js/asset7-pdf-adapter.js
node --check shared/js/pdf-generator.js
node --check shared/js/config-loader.js
node tests/asset7-calc-engine-v5.test.js
node tests/v6-polish-regression.test.js
node tests/v7-batch-regression.test.js
```

Expected output:

```text
PASS asset7 v5 calc engine hotfix: yakacak annualization, tavan order, and eligibility gate verified.
PASS v6 polish regression: 9 requested UX/display fixes preserved in v7.
PASS v7 batch regression: 12 requested items verified, including confirmed ÖTV effective date 2025-12-31.
```
