# Asset 7 PDF Adapter Preflight Notes

## Scope

Only the Asset 7 PDF path was upgraded. No Asset 10 PNG card logic, JSON loader, calculator engine, cross-link partial, or non-PDF component is changed in this delivery.

The production replacement is:

- `js/asset7-pdf-adapter.js`

It expects the existing static page to load a local jsPDF bundle first (`window.jspdf.jsPDF`). It then registers Roboto-Regular and Roboto-Bold into jsPDF VFS before any Turkish text is written.

## Font integration

The adapter supports both approved font paths:

1. Base64 injection before adapter load:
   - `window.ASSET7_ROBOTO_REGULAR_BASE64`
   - `window.ASSET7_ROBOTO_BOLD_BASE64`
2. Static local font fetches:
   - `/assets/fonts/Roboto-Regular.ttf`
   - `/assets/fonts/Roboto-Bold.ttf`

No external font CDN is required. `assets/fonts/README-ROBOTO.txt` documents the static path contract.

## PDF layout coverage

Both bundled QA samples include all 7 required layout sections:

1. Header band
2. Eligibility verdict box
3. Input summary table
4. Calculation breakdown
5. Result block
6. Next steps
7. Footer

Footer ordering is locked as requested: the `Yasal Dayanak` statute block appears above the mandatory disclaimer loaded from `data/asset7.json > pdf_config.footer_disclaimer_tr`.

## Sample PDF fixtures generated

- Eligible fixture: `samples/eligible/kidem-tazminati-hesap-tutanagi-20260508.pdf`
  - Scenario: işveren feshi, 5 yıl, tavan altı
  - Size: 22,218 bytes
- Ineligible fixture: `samples/ineligible/kidem-tazminati-hesap-tutanagi-20260508.pdf`
  - Scenario: istifa
  - Size: 22,158 bytes

Both filenames match the required pattern: `kidem-tazminati-hesap-tutanagi-YYYYMMDD.pdf`.

## Turkish character preflight

Text extraction from both PDFs contains every required Turkish character:

- `ş`
- `ğ`
- `ı`
- `İ`
- `ç`
- `ö`
- `ü`

Representative strings verified in extracted text include:

- `Kıdem Tazminatı Hesap Tutanağı`
- `İşveren tarafından fesih`
- `Giydirilmiş brüt ücret`
- `Ayrılış nedeni`
- `sağlık, işverenin haklı neden teşkil eden davranışları`

## Font preflight

Both sample PDFs contain embedded/subsetted Roboto font programs:

- `Roboto-Regular`: embedded = yes, subset = yes, unicode = yes
- `Roboto-Bold`: embedded = yes, subset = yes, unicode = yes

Bold weight is used for headings, verdict labels, table keys, section headings, and result emphasis.

## Size preflight

Both generated PDFs are under the 500KB Gate 7.3 limit.

## Ineligible behavior

The istifa fixture renders the eligibility verdict and explanation, but no calculated kıdem tazminatı amount is shown. The result block displays `Tutar gösterilmedi`.

## Notes

A prior complete source bundle was not available in the current upload area, so this is delivered as a drop-in replacement bundle for the Asset 7 PDF path rather than a full-site rebuild.