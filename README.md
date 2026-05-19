# Doğru Sonuç Source Delivery — Assets 7 + 10

This bundle packages the current static source for deployment over the existing repo. It is a visible-label leak-stop release only.

## Included

- `index.html` — neutral interim homepage using `dogrusonuc.com` / `Hesaplama Araçları` placeholders.
- `assets/asset7/` — Kıdem Tazminatı Çözümleyici HTML pages and JS calculator/PDF trigger.
- `assets/asset10/` — Doğalgaz Kademe Çözümleyici HTML pages and JS calculator/PNG verdict card generator.
- `shared/css/base.css` — mobile-first shared styles.
- `shared/js/config-loader.js` — JSON loader with `sessionStorage` caching and guarded cross-link partial rendering.
- `shared/js/pdf-generator.js` — Asset 7 PDF adapter bridge.
- `shared/js/asset7-pdf-adapter.js` — embedded-font jsPDF adapter.
- `data/asset7.json` — populated Asset 7 data.
- `data/asset10.json` — populated Asset 10 data.
- `data/portfolio-links.json` — cross-link guard data with locked display names populated for Assets 7 and 10.
- `assets/fonts/Roboto-Regular.ttf` and `assets/fonts/Roboto-Bold.ttf` — local font binaries for Turkish PDF/canvas rendering.
- `vendor/jspdf.umd.min.js` — local jsPDF binary.
- `fixtures/` and `qa-reference/` — QA support artifacts.

## Local run

Use a static file server from the bundle root so ES modules and JSON fetch work:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/`
- `http://localhost:8080/assets/asset7/kidem-tazminati-hesaplama.html`
- `http://localhost:8080/assets/asset10/dogalgaz-kademe-hesaplama.html`

No backend, database, Node build, jQuery, or React is required.

## Deployment note

Upload these files over the existing repo. Do not delete/recreate the repo, because that breaks the existing Vercel webhook.

## v4 label leak fix

- Replaced public Asset 7 labels with `Kıdem Tazminatı Çözümleyici`.
- Replaced public Asset 10 labels with `Doğalgaz Kademe Çözümleyici`.
- Removed internal workstream/phasing labels from the homepage and text artifacts in this bundle.
- Did not change URL paths, filenames, calculator logic, JSON schema, Roboto font paths, or jsPDF vendor path.
