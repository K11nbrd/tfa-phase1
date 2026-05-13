# V8 Notes — Polish Misses + Revenue/SEO Infrastructure

Built on top of v7 and shipped as complete static source.

## Applied fixes

1. Removed the leaked PDF developer test string from `shared/js/asset7-pdf-adapter.js`; the PDF header now renders only the document title.
2. Re-verified and hardened Asset 7 tavan history Roman-to-Arabic period labels by updating `data/asset7.json` labels and preserving render-time normalization in `assets/asset7/asset7.js`.
3. Added locale-aware numeric parsing for Asset 7 wage fields and Asset 10 consumption input. Turkish (`55.500,75`) and period-decimal (`55500.75`) inputs normalize before calculation; outputs remain Turkish-formatted.
4. Added shared GA4 integration through `shared/js/analytics.js`, included in every HTML head with production Measurement ID `G-4XP4GMLKKS`. Added custom events: `calculate_kidem`, `pdf_download`, `calculate_kademe`, `png_share`, and `cross_link_click`.
5. Added root `sitemap.xml` and `robots.txt` for indexing. Sitemap includes every HTML page in the current static package.
6. Verified `vendor/jspdf.umd.min.js` is present. The package preserves the expected Roboto font paths under `assets/fonts/`; font binary files must be supplied from the approved project asset source before deployment.

## Validation

Run:

```bash
node --check assets/asset7/asset7.js
node --check assets/asset10/asset10.js
node --check shared/js/asset7-pdf-adapter.js
node --check shared/js/config-loader.js
node tests/asset7-calc-engine-v5.test.js
node tests/v6-polish-regression.test.js
node tests/v7-batch-regression.test.js
node tests/v8-batch-regression.test.js
```
