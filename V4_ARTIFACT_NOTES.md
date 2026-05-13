# V4 Artifact Notes

This folder is the Vercel-ready static source structure after applying the Asset 7 blank-PDF fix patch to v3.

Runtime entry points:

- `assets/asset7/kidem-tazminati-hesaplama.html`
- `assets/asset10/dogalgaz-kademe-hesaplama.html`

No backend, database, Node build, jQuery, or React is required.

Important: restore `assets/fonts/Roboto-Regular.ttf` and `assets/fonts/Roboto-Bold.ttf` from your licensed/static source before production deploy. The folder includes the exact required paths and contract note, but the generated artifact does not include font binaries.
