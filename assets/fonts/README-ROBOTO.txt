Roboto font source contract for Asset 7 PDF adapter and Asset 10 PNG cards
============================================================================

Required deployment paths:

  assets/fonts/Roboto-Regular.ttf
  assets/fonts/Roboto-Bold.ttf

The JavaScript and HTML templates in this package are wired to these exact
paths. Asset 7 PDF generation uses these files for Turkish glyph coverage in
jsPDF; Asset 10 preloads them for canvas verdict-card rendering.

Do not rename the files or move them without updating the adapter and preload
links.
