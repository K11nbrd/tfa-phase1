# V8.1 Notes — GA4, Footer, Production Domain

Built on top of the shipped v8 package and re-shipped as complete static source.

## Applied follow-up adjustments

1. Replaced the temporary GA4 Measurement ID with the confirmed production Measurement ID `G-4XP4GMLKKS` in `shared/js/analytics.js`.
2. Removed the leaked footer Turkish-character test segment from every HTML page footer. Footer copy now reads exactly: `Bilgilendirme amaçlıdır.`
3. Replaced all hardcoded staging-domain references with `https://dogrusonuc.com`, including every `sitemap.xml` URL and the `robots.txt` sitemap reference.

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
```

## Binary status

`vendor/jspdf.umd.min.js` is included. The v8 source package did not contain `assets/fonts/Roboto-Regular.ttf` or `assets/fonts/Roboto-Bold.ttf`; those font binaries are still represented by the existing `assets/fonts/` deployment notes rather than fabricated replacements.
