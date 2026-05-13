# V4 Notes — Asset 7 PDF Blank Fix Patch

Scope: apply launch-blocker blank PDF remediation to v3 source with no calculator math refactor.

## Integrated changes

- Replaced `shared/js/asset7-pdf-adapter.js` with the blank-fix jsPDF adapter: no canvas snapshot, no manual `%PDF` serialization, jsPDF writes vector rectangles and real text streams.
- Updated `shared/js/pdf-generator.js` bridge to call `window.Asset7Pdf.downloadHesapTutanagi()` and normalize the v3 calculator state into the adapter contract.
- Updated `assets/asset7/asset7.js` so the stored PDF payload includes `departure_reason_id`, `service_days`, `service_years`, salary/allowance aliases, calculation aliases, and an explicit eligibility object.
- Added ihbar note output only when the selected departure reason has `notice_entitlement: true`.
- Preserved the eligibility gate: ineligible verdicts return before downstream amount calculation and do not expose a PDF download button.
- Added `.pdf-error` styling for client-side PDF generation failures.

## Preserved behavior

- Tavan remains applied to monthly giydirilmiş gross before multiplying by service duration.
- Net kıdem remains gross kıdem minus `data/asset7.json` `damga_vergisi_rate`.
- Asset 10 v3 Turkish metadata/font fixes remain unchanged.
- All variable values continue to be read from JSON.

## QA smoke target

Eligible sample: 50,000 base + 3,000 yemek + 2,000 yol + 6,000/year yakacak over 5 years should produce net `₺275.393,78` and ihbar note `8 hafta - ₺103.600,00` in the PDF.
