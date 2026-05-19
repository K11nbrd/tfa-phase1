/*
 * Asset 7 — Kıdem Tazminatı Çözümleyici
 * Embedded-font jsPDF adapter for PDF Hesap Tutanağı.
 *
 * Scope: replaces the old dependency-free fallback PDF generator only.
 * Stack: vanilla JavaScript + locally vendored jsPDF. No backend, no build step.
 *
 * Font contract:
 * - Preferred: expose window.ASSET7_ROBOTO_REGULAR_BASE64 and window.ASSET7_ROBOTO_BOLD_BASE64
 *   before loading this file.
 * - Alternative: serve static TTF files at /assets/fonts/Roboto-Regular.ttf and
 *   /assets/fonts/Roboto-Bold.ttf. This adapter fetches and embeds them into jsPDF VFS.
 */
(function attachAsset7PdfAdapter(global) {
  'use strict';

  const FONT_FAMILY = 'Roboto';
  const FONT_FILES = {
    regular: 'Roboto-Regular.ttf',
    bold: 'Roboto-Bold.ttf'
  };

  const DEFAULT_FONT_SOURCES = {
    regularBase64: () => global.ASSET7_ROBOTO_REGULAR_BASE64 || null,
    boldBase64: () => global.ASSET7_ROBOTO_BOLD_BASE64 || null,
    regularUrl: '/assets/fonts/Roboto-Regular.ttf',
    boldUrl: '/assets/fonts/Roboto-Bold.ttf'
  };

  const STATUTE_BLOCK = [
    'Yasal Dayanak',
    '1475 sayılı İş Kanunu Madde 14 (kıdem tazminatı)',
    '4857 sayılı İş Kanunu Madde 17 (ihbar süreleri)'
  ];

  const TURKISH_LOCALE = 'tr-TR';

  function getJsPDFCtor() {
    const ctor = global.jspdf && global.jspdf.jsPDF;
    if (!ctor) {
      throw new Error('Asset7 PDF adapter requires locally loaded jsPDF: window.jspdf.jsPDF is missing.');
    }
    return ctor;
  }

  function assertConfig(config) {
    if (!config || !config.pdf_config || !config.pdf_config.footer_disclaimer_tr) {
      throw new Error('Asset7 PDF adapter requires data/asset7.json with pdf_config.footer_disclaimer_tr.');
    }
  }

  function yyyymmdd(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  function formatTimestamp(date) {
    return new Intl.DateTimeFormat(TURKISH_LOCALE, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function formatTL(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat(TURKISH_LOCALE, {
      style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);
  }

  function formatNumber(value, digits = 2) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat(TURKISH_LOCALE, {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    }).format(value);
  }

  function buildFilename(generatedAt = new Date()) {
    return `kidem-tazminati-hesap-tutanagi-${yyyymmdd(generatedAt)}.pdf`;
  }

  async function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return global.btoa(binary);
  }

  async function resolveFontBase64(weight, fontSources = {}) {
    const sources = Object.assign({}, DEFAULT_FONT_SOURCES, fontSources);
    const base64Getter = weight === 'bold' ? sources.boldBase64 : sources.regularBase64;
    const directBase64 = typeof base64Getter === 'function' ? base64Getter() : base64Getter;
    if (directBase64) return directBase64;

    const url = weight === 'bold' ? sources.boldUrl : sources.regularUrl;
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Roboto ${weight} font could not be loaded from ${url}.`);
    }
    return arrayBufferToBase64(await response.arrayBuffer());
  }

  async function registerRoboto(doc, fontSources) {
    const regular = await resolveFontBase64('regular', fontSources);
    const bold = await resolveFontBase64('bold', fontSources);
    doc.addFileToVFS(FONT_FILES.regular, regular);
    doc.addFont(FONT_FILES.regular, FONT_FAMILY, 'normal');
    doc.addFileToVFS(FONT_FILES.bold, bold);
    doc.addFont(FONT_FILES.bold, FONT_FAMILY, 'bold');
    doc.setFont(FONT_FAMILY, 'normal');
  }

  function setText(doc, text, x, y, opts = {}) {
    doc.setFont(FONT_FAMILY, opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 10);
    doc.setTextColor.apply(doc, opts.color || [20, 30, 45]);
    doc.text(String(text || ''), x, y, opts.align ? { align: opts.align } : undefined);
  }

  function drawWrapped(doc, text, x, y, maxWidth, opts = {}) {
    doc.setFont(FONT_FAMILY, opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 9);
    doc.setTextColor.apply(doc, opts.color || [20, 30, 45]);
    const lines = doc.splitTextToSize(String(text || ''), maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * (opts.lineHeight || 5);
  }

  function drawSectionTitle(doc, title, x, y) {
    setText(doc, title, x, y, { bold: true, size: 11, color: [15, 23, 42] });
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y + 2, 200, y + 2);
    return y + 8;
  }

  function drawKeyValueRows(doc, rows, x, y, col1 = 58, col2 = 82) {
    let cursorY = y;
    rows.forEach((row, index) => {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(8.7);
      const valueLines = doc.splitTextToSize(String(row[1] || '-'), col2 - 4);
      const rowH = Math.max(7.2, valueLines.length * 4.2 + 4.8);
      doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
      doc.rect(x, cursorY - 4.5, col1 + col2, rowH, 'F');
      setText(doc, row[0], x + 2, cursorY, { bold: true, size: 8.7, color: [51, 65, 85] });
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(8.7);
      doc.setTextColor(15, 23, 42);
      doc.text(valueLines, x + col1, cursorY);
      cursorY += rowH;
    });
    return cursorY + 3;
  }

  function normalizeInputRows(input) {
    return [
      ['Ayrılış nedeni', input.departure_reason_label_tr || input.departure_reason || '-'],
      ['Çalışma süresi', input.tenure_label_tr || `${formatNumber(input.service_multiplier || 0, 2)} yıl`],
      ['Brüt ücret', formatTL(input.base_salary_tl)],
      ['Yemek yardımı', formatTL(input.food_allowance_tl || 0)],
      ['Yol yardımı', formatTL(input.transport_allowance_tl || 0)],
      ['Yakacak yardımı', formatTL(input.fuel_allowance_monthly_tl || 0)]
    ];
  }

  function normalizeCalculationRows(result, config) {
    if (!result.eligible) {
      return [
        ['Uygunluk kararı', 'Uygun değil'],
        ['Hesaplama durumu', 'Kıdem tazminatı tutarı hesaplanmadı.'],
        ['Gerekçe', result.verdict_text_tr || '-']
      ];
    }
    return [
      ['Giydirilmiş brüt ücret', formatTL(result.giydirilmis_ucret_tl)],
      ['Kıdem tavanı', formatTL(config.tavan && config.tavan.current_tl_per_year)],
      ['Tavan sonrası aylık esas', formatTL(result.capped_monthly_tl)],
      ['Hizmet çarpanı', `${formatNumber(result.service_multiplier, 4)} yıl`],
      ['Brüt kıdem tazminatı', formatTL(result.gross_kidem_tl)],
      ['Damga vergisi', `-${formatTL(result.damga_vergisi_tl)}`],
      ['Net kıdem tazminatı', formatTL(result.net_kidem_tl)]
    ];
  }

  function drawHeader(doc, config, generatedAt) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 27, 'F');
    setText(doc, config.pdf_config.title_tr || 'Kıdem Tazminatı Hesap Tutanağı', 12, 13, {
      bold: true, size: 15, color: [255, 255, 255]
    });
    setText(doc, `Oluşturma zamanı: ${formatTimestamp(generatedAt)}`, 12, 21, {
      size: 8.5, color: [226, 232, 240]
    });
  }

  function drawVerdict(doc, result, x, y) {
    const eligible = !!result.eligible;
    doc.setFillColor(eligible ? 236 : 254, eligible ? 253 : 242, eligible ? 245 : 242);
    doc.setDrawColor(eligible ? 16 : 185, eligible ? 185 : 28, eligible ? 129 : 28);
    doc.roundedRect(x, y, 186, 27, 3, 3, 'FD');
    setText(doc, eligible ? 'UYGUNLUK KARARI: HAK KAZANILDI' : 'UYGUNLUK KARARI: HAK KAZANILMADI', x + 4, y + 8, {
      bold: true, size: 11, color: eligible ? [6, 95, 70] : [127, 29, 29]
    });
    drawWrapped(doc, result.verdict_text_tr || '-', x + 4, y + 15, 177, { size: 8.5, lineHeight: 4 });
    return y + 33;
  }

  function drawResultBlock(doc, result, x, y) {
    doc.setFillColor(result.eligible ? 240 : 248, result.eligible ? 253 : 250, result.eligible ? 244 : 252);
    doc.roundedRect(x, y, 186, 21, 3, 3, 'F');
    if (result.eligible) {
      setText(doc, 'Net kıdem tazminatı', x + 5, y + 8, { bold: true, size: 10, color: [22, 101, 52] });
      setText(doc, formatTL(result.net_kidem_tl), x + 181, y + 15, { bold: true, size: 17, color: [22, 101, 52], align: 'right' });
    } else {
      setText(doc, 'Sonuç', x + 5, y + 8, { bold: true, size: 10, color: [71, 85, 105] });
      setText(doc, 'Tutar gösterilmedi', x + 181, y + 15, { bold: true, size: 13, color: [71, 85, 105], align: 'right' });
    }
    return y + 28;
  }

  function drawFooter(doc, config) {
    const x = 12;
    let y = 250;
    doc.setDrawColor(226, 232, 240);
    doc.line(x, y - 4, 198, y - 4);

    setText(doc, STATUTE_BLOCK[0], x, y, { bold: true, size: 8.2, color: [15, 23, 42] });
    y += 4.5;
    setText(doc, STATUTE_BLOCK[1], x, y, { size: 7.7, color: [51, 65, 85] });
    y += 4;
    setText(doc, STATUTE_BLOCK[2], x, y, { size: 7.7, color: [51, 65, 85] });
    y += 6;

    drawWrapped(doc, config.pdf_config.footer_disclaimer_tr, x, y, 186, {
      size: 7.2, lineHeight: 3.4, color: [71, 85, 105]
    });
  }

  async function createKidemTazminatiPdf(options) {
    const config = options.config;
    const input = options.input || {};
    const result = options.result || {};
    const generatedAt = options.generatedAt || new Date();
    assertConfig(config);

    const jsPDF = options.jsPDF || getJsPDFCtor();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    await registerRoboto(doc, options.fontSources || {});

    drawHeader(doc, config, generatedAt);
    let y = 36;
    y = drawVerdict(doc, result, 12, y);

    y = drawSectionTitle(doc, '1. Girdi Özeti', 12, y);
    y = drawKeyValueRows(doc, normalizeInputRows(input), 12, y, 55, 126);

    y = drawSectionTitle(doc, '2. Hesaplama Dökümü', 12, y);
    y = drawKeyValueRows(doc, normalizeCalculationRows(result, config), 12, y, 65, 116);

    y = drawSectionTitle(doc, '3. Sonuç Bloğu', 12, y);
    y = drawResultBlock(doc, result, 12, y);

    y = drawSectionTitle(doc, '4. Sonraki Adımlar', 12, y);
    const defaultNextSteps = result.eligible
      ? 'Bordro, fesih bildirimi, SGK hizmet dökümü ve banka ödeme kayıtlarını saklayın. Uyuşmazlık halinde arabuluculuk başvurusu zorunlu dava şartıdır.'
      : 'Haklı neden, askerlik, emeklilik, evlilik veya sağlık gibi istisnai durumlar varsa belgeyle ayrıca değerlendirin. Sayısal tutar gösterilmeden önce uygunluk kararı netleştirilmelidir.';
    y = drawWrapped(doc, result.next_steps_tr || defaultNextSteps, 12, y, 186, { size: 9, lineHeight: 4.4 });

    if (result.death_note_tr) {
      y += 3;
      y = drawWrapped(doc, `Veraset notu: ${result.death_note_tr}`, 12, y, 186, { size: 8.5, lineHeight: 4.2 });
    }

    drawFooter(doc, config);

    return {
      doc,
      filename: buildFilename(generatedAt)
    };
  }

  async function downloadKidemTazminatiPdf(options) {
    const payload = await createKidemTazminatiPdf(options);
    payload.doc.save(payload.filename);
    return payload.filename;
  }

  async function getKidemTazminatiPdfBlob(options) {
    const payload = await createKidemTazminatiPdf(options);
    return {
      filename: payload.filename,
      blob: payload.doc.output('blob')
    };
  }

  global.Asset7PdfAdapter = Object.freeze({
    createKidemTazminatiPdf,
    downloadKidemTazminatiPdf,
    getKidemTazminatiPdfBlob,
    buildFilename,
    STATUTE_BLOCK: STATUTE_BLOCK.slice()
  });
})(window);