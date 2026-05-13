# V6 Notes — Pre-Launch Polish Batch

Source base: `tfa_phase1_source_delivery_v5_CALC_ENGINE_HOTFIX_vercel.zip`

Scope: render-layer and UX polish only. No schema changes and no data JSON edits. The v5 calc-engine hotfix remains intact.

## Fixes applied

1. **Asset 7 PDF service duration display**
   - Files: `assets/asset7/asset7.js`, `shared/js/asset7-pdf-adapter.js`
   - PDF payload now passes `tenure_label_tr` as a humanized label, e.g. `5 yıl 1 gün`.
   - PDF adapter includes its own fallback `humanizeServiceDuration(totalDays)` helper.
   - Engine still uses day-count-derived `serviceMultiplier` internally.

2. **Asset 7 tavan history newest-first render**
   - File: `assets/asset7/asset7.js`
   - `tavan_history[]` is reversed at render time only. `data/asset7.json` remains unchanged.

3. **Asset 10 month order calendar-first**
   - File: `assets/asset10/asset10.js`
   - Added canonical `MONTH_ORDER` and `orderedMonthEntries()` so all monthly limits render Ocak → Aralık regardless of object insertion order.

4. **Asset 7 ineligible İstifa screen hides tavan**
   - Files: `assets/asset7/kidem-tazminati-hesaplama.html`, `assets/asset7/asset7.js`
   - Calculator tavan note is hidden by default and only shown after an eligible calculation.
   - Ineligible verdicts explicitly hide the tavan note.

5. **Asset 7 dropdown copy softened: İşçinin vefatı**
   - File: `assets/asset7/asset7.js`
   - User-facing dropdown renders `İşçinin vefatı` for reason id `olum`.
   - `data/asset7.json` remains unchanged, preserving statutory wording and citations.

6. **Asset 7 numeric input UX**
   - Files: `assets/asset7/kidem-tazminati-hesaplama.html`, `assets/asset7/asset7.js`
   - All calculator number inputs default to `0`.
   - On focus, `0` clears. On blur, empty value resets to `0`.

7. **Asset 7 gender field conditional visibility**
   - Files: `assets/asset7/kidem-tazminati-hesaplama.html`, `assets/asset7/asset7.js`
   - Gender field hidden by default.
   - Shows only when `Evlilik` is selected.
   - Required only for `Evlilik`, with no default selected value.
   - Cleared automatically when user switches away from `Evlilik`.

8. **Asset 10 province dropdown popular section**
   - File: `assets/asset10/asset10.js`
   - Province selector now renders `Sık seçilen iller` optgroup with İstanbul, Ankara, İzmir at top.
   - Full `Tüm iller (A-Z)` optgroup remains below and still includes all 81 provinces, including Big 3 duplicates.

9. **Asset 10 verdict enum leak removed**
   - File: `assets/asset10/asset10.js`
   - User-facing result and PNG card headline now map:
     - `KADEME_2` → `Yüksek tarife uygulanır`
     - `KADEME_1` → `Standart tarife uygulanır`
   - Raw enums remain internal only for calculation logic.

## Validation run

```bash
node --check assets/asset7/asset7.js
node --check assets/asset10/asset10.js
node --check shared/js/asset7-pdf-adapter.js
node tests/asset7-calc-engine-v5.test.js
node tests/v6-polish-regression.test.js
```

Results:

```text
PASS asset7 v5 calc engine hotfix: yakacak annualization, tavan order, and eligibility gate verified.
PASS v6 polish regression: 9 requested UX/display fixes verified with unchanged JSON schemas.
```

## Data integrity

Verified unchanged from v5:

- `data/asset7.json`
- `data/asset10.json`
- `data/portfolio-links.json`
