# V5 Notes — Asset 7 Calc Engine Hotfix

## Scope

This v5 package is the complete v4 source with the Asset 7 calculation-engine hotfix applied in-place.

## Fixed logic

- `assets/asset7/asset7.js` now explicitly converts annual yakacak allowance to monthly as:
  - `fuelMonthly = input.fuelAnnual / MONTHS_PER_YEAR`
- The giydirilmiş monthly wage calculation is:
  - `base + yemek_aylik + yol_aylik + yakacak_yillik / 12`
- Yemek and yol remain monthly inputs and are added as-is.
- Eligibility still returns early before any numeric amount is computed for ineligible scenarios.
- Tavan still applies to the monthly giydirilmiş wage before multiplying by service duration.
- PDF output state now receives the same monthly yakacak value calculated by the engine.

## Regression command

Run from repository root:

```bash
node tests/asset7-calc-engine-v5.test.js
```

Expected output:

```text
PASS asset7 v5 calc engine hotfix: yakacak annualization, tavan order, and eligibility gate verified.
```

## Blocker fixture verified

Inputs:

- Aylık brüt ücret: 50,000 TL
- Yemek yardımı: 3,000 TL/month
- Yol yardımı: 2,000 TL/month
- Yakacak yardımı: 6,000 TL/year
- Service multiplier: 5.0
- Ayrılış nedeni: eligible employer termination

Expected and verified:

- Giydirilmiş aylık: 55,500.00 TL
- Brüt kıdem: 277,500.00 TL
- Damga vergisi: 2,106.23 TL
- Net kıdem: 275,393.78 TL
