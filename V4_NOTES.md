# Phase 1 Source Delivery v4 — Post-Launch Fix Bundle

## Source-state note

This package was built from the latest source artifact available in project knowledge: `tfa_phase1_source_delivery_v3_QA_FINAL_directory_dump.md`.

The accessible v3 source did **not** contain the four-part Asset 7 evlilik gender fix: the gender field was visible by default, included a third option, did not emit an immediate Erkek+Evlilik ineligibility verdict, and did not show the Kadın+Evlilik one-year disclosure.

Production source version could not be independently fetched from this build environment, so this v4 package applies the 2026-05-20 routing spec into the latest accessible source state.

## Fix 1 — Asset 7 evlilik gender logic

Implemented the four coupled fixes on `assets/asset7/kidem-tazminati-hesaplama.html` and `assets/asset7/asset7.js`:

- Gender field is hidden by default.
- Gender field appears only for `evlilik`, becomes required, and has no default user answer.
- Gender dropdown now contains only `Kadın` and `Erkek` user choices.
- `Evlilik + Erkek` immediately renders the locked ineligibility verdict and collapses downstream form fields.
- `Evlilik + Kadın` displays the locked one-year disclosure above the calculate button, including the required `kaybedilir` wording.
- No `marriage_date` field or 365-day marriage-window validation was added; that remains out of scope for this deploy.

Locked strings used verbatim:

- `Evlilik istisnası yalnızca kadın işçi için uygulanır.`
- `Evlilik nedeniyle kıdem tazminatı yalnızca nikah tarihinden itibaren 1 yıl içinde ayrılan kadın işçiler için geçerlidir. Bu süre dolduktan sonra hak kaybedilir.`

## Fix 2 — Debug footer removal

Removed the development diagnostic Turkish-character footer string from public HTML surfaces in Asset 7 and Asset 10, including the two routed calculator pages:

- `assets/asset7/kidem-tazminati-hesaplama.html`
- `assets/asset10/dogalgaz-kademe-hesaplama.html`

## Portfolio links refresh

Updated `data/portfolio-links.json` to the current 2026-05-19 master supplied by Command Center.

Confirmed current master values:

- `asset_7_kidem.live = true`
- `asset_7_kidem.display_name_tr = "Kıdem Tazminatı Çözümleyici"`
- `asset_10_dogalgaz.live = true`
- `asset_10_dogalgaz.display_name_tr = "Doğalgaz Kademe Çözümleyici"`
- `canonical_url = null` remains intentional portfolio-wide pending Architect URL ruling.

## Public display-name cleanup retained

Replaced internal codename-style public labels in the accessible source with the locked public display names:

- `Kıdem Tazminatı Çözümleyici`
- `Doğalgaz Kademe Çözümleyici`

## Verification performed

- `node --check assets/asset7/asset7.js` passed.
- `node --check assets/asset10/asset10.js` passed.
- Repository grep confirmed no remaining development diagnostic footer strings in public source surfaces.
- Repository grep confirmed no remaining internal codename-style public labels in public source surfaces.
- Confirmed bundled binaries remain present:
  - `assets/fonts/Roboto-Regular.ttf`
  - `assets/fonts/Roboto-Bold.ttf`
  - `vendor/jspdf.umd.min.js`
