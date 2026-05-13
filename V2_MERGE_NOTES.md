# Phase 1 Source Delivery v2 — Asset 7 PDF Adapter Merge

## Integrated changes

- Added `shared/js/asset7-pdf-adapter.js` from `asset7-pdf-adapter-bundle.zip`.
- Replaced the old `shared/js/pdf-generator.js` fallback implementation with a bridge to `window.Asset7PdfAdapter.downloadKidemTazminatiPdf()`.
- Updated `assets/asset7/asset7.js` so the PDF click handler passes normalized `input` and `result` objects with the numeric fields expected by the adapter.
- Updated `assets/asset7/kidem-tazminati-hesaplama.html` to load the PDF adapter before the Asset 7 module.
- Added adapter QA samples and fixtures under `qa-reference/asset7-pdf-adapter/`.
- Added font-path contract under `assets/fonts/README-ROBOTO.txt`.

## Preserved behavior

- Eligibility gate still returns before downstream calculations for ineligible users.
- Tavan is still applied to monthly giydirilmiş gross before multiplying by service duration.
- Asset 10 source and data were not modified.

## Dependency status

The integrated source includes the adapter wiring and path contract. The local jsPDF UMD vendor file is now bundled at:

- `vendor/jspdf.umd.min.js`

The Asset 7 PDF adapter should load this local file before `shared/js/asset7-pdf-adapter.js`; no CDN dependency is required for jsPDF.

## v2.1 Binary Bundle Update — 2026-05-08

Routing requested self-contained PDF dependencies for Asset 7. Roboto font binaries have been bundled at the adapter contract paths:

- `assets/fonts/Roboto-Regular.ttf`
- `assets/fonts/Roboto-Bold.ttf`

The Asset 7 calculator page already points to the local jsPDF path `../../vendor/jspdf.umd.min.js`, and the adapter font contract resolves fonts from `/assets/fonts/Roboto-Regular.ttf` and `/assets/fonts/Roboto-Bold.ttf`.

Note: `vendor/jspdf.umd.min.js` is present in this package for QA.
