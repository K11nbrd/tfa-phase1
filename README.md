# TFA Phase 1 Source Delivery — Assets 7 + 10

This bundle packages the current static source for QA pickup per the source-delivery brief.

## Included

- `assets/asset7/` — Kıdem Tazminatı Çözümleyici HTML pages and JS calculator/PDF trigger
- `assets/asset10/` — Doğalgaz Kademe Çözümleyici HTML pages and JS calculator/PNG verdict card generator
- `shared/css/base.css` — mobile-first shared styles
- `shared/js/config-loader.js` — JSON loader with `sessionStorage` caching and guarded cross-link partial rendering
- `shared/js/pdf-generator.js` — Asset 7 PDF adapter bridge (calls embedded-font jsPDF adapter)
- `data/asset7.json` — populated Asset 7 data
- `data/asset10.json` — populated Asset 10 data
- `data/portfolio-links.json` — cross-link guard data
- `fixtures/` — initial QA scenario fixtures for Tier B/C gates

## Local run

Use a static file server from the bundle root so ES modules and JSON fetch work:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/assets/asset7/kidem-tazminati-hesaplama.html`
- `http://localhost:8080/assets/asset10/dogalgaz-kademe-hesaplama.html`

No backend, database, Node build, jQuery, or React is required.

## QA notes / known caveats

1. This is a static source package, not a deployed staging URL. Tier D gates still require staging/CDN setup.
2. Asset 7 PDF generation is dependency-free and client-side. QA should still run the Turkish-character PDF gate; the approved embedded-font jsPDF adapter is wired to the local vendor bundle before launch QA.
3. Cross-link partials intentionally render nothing when sibling assets are not live or when `canonical_url`/CTA fields are null.
4. Asset 10 full-bill-flip warning is injected on every page from `asset10.json` and repeated on every Kademe-2 PNG card.
5. Variable rates, limits, tavan, warnings, and portfolio-link status are read from JSON files.


## v2 PDF adapter merge notes

- Asset 7 calculator now routes PDF generation through `shared/js/asset7-pdf-adapter.js`.
- The previous dependency-free fallback PDF generator has been replaced by a bridge in `shared/js/pdf-generator.js`; calculation and eligibility logic remain in `assets/asset7/asset7.js`.
- QA reference PDFs, fixtures, and preflight notes from the adapter bundle are included under `qa-reference/asset7-pdf-adapter/`.
- The adapter expects a locally vendored jsPDF UMD file at `vendor/jspdf.umd.min.js` and Roboto font sources per `assets/fonts/README-ROBOTO.txt`. This package now includes the local jsPDF UMD file at the expected vendor path.