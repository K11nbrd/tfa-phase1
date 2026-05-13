/*
 * Asset 7 — Kıdem Tazminatı Hesap Tutanağı PDF Adapter
 * Static/client-only. No canvas snapshots. No manual PDF serialization.
 * Requires local jsPDF UMD loaded before this file:
 *   /vendor/jspdf.umd.min.js
 * Requires local fonts served from one of the static candidate paths, including:
 *   /assets/fonts/Roboto-Regular.ttf
 *   /assets/fonts/Roboto-Bold.ttf
 */
(function attachAsset7Pdf(global) {
  'use strict';

  const FONT_FAMILY = 'Roboto';
  const FONT_CANDIDATE_ROOTS = [
    '/asset7/assets/fonts/',
    '/assets/fonts/',
    '../assets/fonts/',
    '../../assets/fonts/'
  ];

  const FONT_FILES = {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Bold.ttf'
  };

  const COLORS = Object.freeze({
    ink: [24, 24, 27],
    muted: [82, 82, 91],
    border: [212, 212, 216],
    surface: [250, 250, 250],
    header: [20, 83, 45],
    eligible: [22, 101, 52],
    ineligible: [153, 27, 27],
    amber: [146, 64, 14]
  });

  let fontRegistrationPromise = null;

  function getJsPDFCtor() {
    const jsPDF = global.jspdf && global.jspdf.jsPDF;
    if (!jsPDF) {
      throw new Error('Asset7 PDF: jsPDF bulunamadı. /vendor/jspdf.umd.min.js bu dosyadan önce yüklenmeli.');
    }
    return jsPDF;
  }

  function asNumber(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value
        .replace(/\s/g, '')
        .replace(/₺/g, '')
        .replace(/TRY/gi, '')
        .replace(/\./g, '')
        .replace(',', '.');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  function pickNumber(source, keys, fallback = 0) {
    for (const key of keys) {
      const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
      if (value !== undefined && value !== null && value !== '') return asNumber(value, fallback);
    }
    return fallback;
  }

  function pickString(source, keys, fallback = '') {
    for (const key of keys) {
      const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return fallback;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(asNumber(value));
  }

  function formatDecimal(value, digits = 4) {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(asNumber(value));
  }

  function formatInteger(value) {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(asNumber(value));
  }


  function humanizeServiceDuration(totalDays) {
    const days = Math.max(0, asNumber(totalDays));
    let years = Math.floor(days / 365.25);
    let remainder = Math.round(days - (years * 365.25));
    if (remainder >= 365) {
      years += 1;
      remainder = 0;
    }
    const parts = [`${formatInteger(years)} yıl`];
    if (remainder === 1) parts.push('1 gün');
    else if (remainder > 1) parts.push(`${formatInteger(remainder)} gün`);
    return parts.join(' ');
  }

  function filenameDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function displayTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(date);
  }

  async function fetchAsBase64(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Asset7 PDF: Font yüklenemedi (${response.status}) ${url}`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  async function resolveFontUrl(fileName) {
    const errors = [];
    for (const root of FONT_CANDIDATE_ROOTS) {
      const url = `${root}${fileName}`;
      try {
        const probe = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
        if (probe.ok) return url;
        errors.push(`${url} -> ${probe.status}`);
      } catch (error) {
        errors.push(`${url} -> ${error.message}`);
      }
    }
    throw new Error(`Asset7 PDF: ${fileName} bulunamadı. Denenen yollar: ${errors.join(' | ')}`);
  }

  async function registerFonts(doc) {
    if (!fontRegistrationPromise) {
      fontRegistrationPromise = (async () => {
        const regularUrl = await resolveFontUrl(FONT_FILES.normal);
        const boldUrl = await resolveFontUrl(FONT_FILES.bold);
        const [regularBase64, boldBase64] = await Promise.all([
          fetchAsBase64(regularUrl),
          fetchAsBase64(boldUrl)
        ]);
        return { regularBase64, boldBase64 };
      })();
    }

    const fonts = await fontRegistrationPromise;
    doc.addFileToVFS(FONT_FILES.normal, fonts.regularBase64);
    doc.addFont(FONT_FILES.normal, FONT_FAMILY, 'normal');
    doc.addFileToVFS(FONT_FILES.bold, fonts.boldBase64);
    doc.addFont(FONT_FILES.bold, FONT_FAMILY, 'bold');
    doc.setFont(FONT_FAMILY, 'normal');
  }

  function findReason(data, input) {
    const reasonId = pickString(input, [
      'departure_reason_id',
      'departureReasonId',
      'departure_reason',
      'departureReason',
      'reason_id',
      'reasonId'
    ]);
    const reasons = data?.eligibility_rules?.departure_reasons || [];
    return reasons.find((item) => item.id === reasonId) || reasons[0] || null;
  }

  function findNoticeWeeks(data, serviceDays) {
    const periods = data?.ihbar_periods || [];
    const matched = periods.find((period) => {
      return serviceDays >= asNumber(period.tenure_min_days) && serviceDays <= asNumber(period.tenure_max_days);
    });
    return matched ? asNumber(matched.notice_weeks) : 0;
  }

  function deriveInput(input) {
    const baseSalary = pickNumber(input, ['base_salary_tl', 'baseSalaryTl', 'base_salary', 'baseSalary', 'salary', 'maas'], 0);
    const yemek = pickNumber(input, ['yemek_tl', 'yemekTl', 'food_allowance_tl', 'foodAllowanceTl', 'yemek'], 0);
    const yol = pickNumber(input, ['yol_tl', 'yolTl', 'transport_allowance_tl', 'transportAllowanceTl', 'yol'], 0);
    const yakacakYearly = pickNumber(input, ['yakacak_yearly_tl', 'yakacakYearlyTl', 'annual_fuel_tl', 'annualFuelTl', 'yakacak_yillik'], 0);
    const yakacakMonthlyExplicit = pickNumber(input, ['yakacak_monthly_tl', 'yakacakMonthlyTl', 'monthly_fuel_tl', 'monthlyFuelTl', 'fuel_allowance_monthly_tl', 'fuelAllowanceMonthlyTl'], NaN);
    const yakacakMonthly = Number.isFinite(yakacakMonthlyExplicit) ? yakacakMonthlyExplicit : yakacakYearly / 12;

    const serviceYearsExplicit = pickNumber(input, ['service_years', 'serviceYears', 'tenure_years', 'tenureYears', 'service_multiplier', 'serviceMultiplier'], NaN);
    const serviceDaysExplicit = pickNumber(input, ['service_days', 'serviceDays', 'tenure_days', 'tenureDays', 'hizmet_gunu'], NaN);
    const serviceDays = Number.isFinite(serviceDaysExplicit) ? serviceDaysExplicit : (Number.isFinite(serviceYearsExplicit) ? Math.round(serviceYearsExplicit * 365) : 0);
    const serviceYears = Number.isFinite(serviceYearsExplicit) ? serviceYearsExplicit : serviceDays / 365;

    return {
      baseSalary,
      yemek,
      yol,
      yakacakYearly,
      yakacakMonthly,
      serviceDays,
      serviceYears,
      giydirilmisBrut: baseSalary + yemek + yol + yakacakMonthly
    };
  }

  function evaluateEligibility(data, input, reason, derived) {
    const minimumTenureDays = asNumber(reason?.requires_minimum_tenure_days, asNumber(data?.eligibility_rules?.minimum_tenure_days, 365));
    const reasonEligible = Boolean(reason?.eligible);
    const hasMinimumTenure = derived.serviceDays >= minimumTenureDays;

    let eligible = reasonEligible && hasMinimumTenure;
    let verdictText = reason?.verdict_text_tr || '';

    const gender = pickString(input, ['gender', 'sex', 'cinsiyet'], '').toLowerCase();
    if (reason?.id === 'evlilik' && gender && !['female', 'kadin', 'kadın'].includes(gender)) {
      eligible = false;
      verdictText = 'Evlilik nedeniyle fesih istisnası yalnızca kadın işçi için uygulanır.';
    }

    if (reasonEligible && !hasMinimumTenure) {
      eligible = false;
      verdictText = `Kıdem tazminatı için en az ${formatInteger(minimumTenureDays)} gün hizmet şartı aranır. Girilen hizmet süresi ${formatInteger(derived.serviceDays)} gündür.`;
    }

    return {
      eligible,
      verdictText,
      statuteCitation: reason?.statute_citation || '1475 sayılı İş Kanunu Madde 14',
      noticeEntitlement: Boolean(reason?.notice_entitlement)
    };
  }

  function deriveCalculation(data, input, passedResult, passedEligibility) {
    const reason = findReason(data, input);
    const derived = deriveInput(input);
    const evaluated = evaluateEligibility(data, input, reason, derived);

    const eligibility = {
      ...evaluated,
      eligible: typeof passedEligibility?.eligible === 'boolean' ? passedEligibility.eligible : evaluated.eligible,
      verdictText: pickString(passedEligibility || {}, ['verdictText', 'verdict_text_tr', 'text'], evaluated.verdictText),
      statuteCitation: pickString(passedEligibility || {}, ['statuteCitation', 'statute_citation'], evaluated.statuteCitation)
    };

    if (!eligibility.eligible) {
      return { reason, derived, eligibility, calculation: null };
    }

    const tavan = asNumber(data?.tavan?.current_tl_per_year, 0);
    const damgaRate = asNumber(data?.damga_vergisi_rate, 0);
    const cappedMonthly = Math.min(derived.giydirilmisBrut, tavan);
    const gross = cappedMonthly * derived.serviceYears;
    const stampTax = gross * damgaRate;
    const net = gross - stampTax;
    const noticeWeeks = findNoticeWeeks(data, derived.serviceDays);
    const noticeGross = eligibility.noticeEntitlement ? (derived.giydirilmisBrut / 30) * noticeWeeks * 7 : 0;

    const result = passedResult || {};
    const calculation = {
      giydirilmisBrut: pickNumber(result, ['giydirilmis_brut', 'giydirilmisBrut', 'giydirilmis_ucret_tl', 'giydirilmisUcretTl', 'amounts.giydirilmis_brut'], derived.giydirilmisBrut),
      cappedMonthly: pickNumber(result, ['capped_monthly', 'cappedMonthly', 'capped_monthly_tl', 'cappedMonthlyTl', 'amounts.capped_monthly'], cappedMonthly),
      gross: pickNumber(result, ['gross_kidem', 'grossKidem', 'gross_kidem_tl', 'grossKidemTl', 'brut_kidem', 'amounts.gross_kidem'], gross),
      stampTax: pickNumber(result, ['damga_vergisi', 'damga_vergisi_tl', 'damgaVergisiTl', 'stampTax', 'stamp_tax', 'amounts.damga_vergisi'], stampTax),
      net: pickNumber(result, ['net_kidem', 'netKidem', 'net_kidem_tl', 'netKidemTl', 'net_kidem_tazminati', 'netKidemTazminati', 'amounts.net_kidem'], net),
      noticeWeeks: pickNumber(result, ['notice_weeks', 'noticeWeeks', 'ihbar_weeks'], noticeWeeks),
      noticeGross: pickNumber(result, ['ihbar_gross', 'ihbarGross', 'notice_gross', 'amounts.ihbar_gross'], noticeGross),
      tavan,
      damgaRate
    };

    return { reason, derived, eligibility, calculation, input };
  }

  function pageMetrics(doc) {
    return {
      width: doc.internal.pageSize.getWidth(),
      height: doc.internal.pageSize.getHeight(),
      marginX: 15,
      y: 0
    };
  }

  function setTextColor(doc, color = COLORS.ink) {
    doc.setTextColor(color[0], color[1], color[2]);
  }

  function setFillColor(doc, color) {
    doc.setFillColor(color[0], color[1], color[2]);
  }

  function setDrawColor(doc, color) {
    doc.setDrawColor(color[0], color[1], color[2]);
  }

  function ensureSpace(doc, state, neededHeight) {
    if (state.y + neededHeight <= state.height - 18) return;
    doc.addPage();
    state.y = 18;
  }

  function text(doc, value, x, y, options = {}) {
    const size = options.size || 10;
    const weight = options.weight || 'normal';
    const color = options.color || COLORS.ink;
    doc.setFont(FONT_FAMILY, weight);
    doc.setFontSize(size);
    setTextColor(doc, color);
    doc.text(String(value ?? ''), x, y, options.align ? { align: options.align } : undefined);
  }

  function wrappedText(doc, value, x, y, width, options = {}) {
    const size = options.size || 10;
    const weight = options.weight || 'normal';
    const lineHeight = options.lineHeight || size * 0.42;
    doc.setFont(FONT_FAMILY, weight);
    doc.setFontSize(size);
    setTextColor(doc, options.color || COLORS.ink);
    const lines = doc.splitTextToSize(String(value ?? ''), width);
    doc.text(lines, x, y);
    return lines.length * lineHeight;
  }

  function sectionTitle(doc, state, title) {
    ensureSpace(doc, state, 16);
    text(doc, title, state.marginX, state.y, { size: 15, weight: 'bold' });
    state.y += 8;
  }

  function keyValueRows(doc, state, rows) {
    const labelX = state.marginX + 3;
    const valueX = state.marginX + 82;
    const rowHeight = 8;
    ensureSpace(doc, state, rows.length * rowHeight + 6);
    rows.forEach((row, index) => {
      const y = state.y + index * rowHeight;
      if (index % 2 === 0) {
        setFillColor(doc, COLORS.surface);
        doc.rect(state.marginX, y - 5, state.width - state.marginX * 2, rowHeight, 'F');
      }
      text(doc, row[0], labelX, y, { size: 10, color: COLORS.muted });
      text(doc, row[1], valueX, y, { size: 10, weight: row[2] === 'bold' ? 'bold' : 'normal' });
    });
    state.y += rows.length * rowHeight + 6;
  }

  function drawHeader(doc, state, data) {
    setFillColor(doc, COLORS.header);
    doc.rect(0, 0, state.width, 34, 'F');
    text(doc, data?.pdf_config?.title_tr || 'Kıdem Tazminatı Hesap Tutanağı', state.marginX, 16, {
      size: 19,
      weight: 'bold',
      color: [255, 255, 255]
    });
    state.y = 48;
  }

  function drawVerdictBox(doc, state, payload) {
    const { eligibility } = payload;
    const boxColor = eligibility.eligible ? COLORS.eligible : COLORS.ineligible;
    const boxHeight = 33;
    ensureSpace(doc, state, boxHeight + 10);
    setFillColor(doc, boxColor);
    doc.roundedRect(state.marginX, state.y - 8, state.width - state.marginX * 2, boxHeight, 3, 3, 'F');
    text(doc, eligibility.eligible ? 'Uygunluk Kararı: Kıdem tazminatına uygun' : 'Uygunluk Kararı: Kıdem tazminatına uygun değil', state.marginX + 6, state.y + 2, {
      size: 13,
      weight: 'bold',
      color: [255, 255, 255]
    });
    wrappedText(doc, eligibility.verdictText, state.marginX + 6, state.y + 12, state.width - state.marginX * 2 - 12, {
      size: 9,
      color: [255, 255, 255],
      lineHeight: 4
    });
    state.y += boxHeight + 10;
  }

  function drawInputSummary(doc, state, payload) {
    const { reason, derived, calculation, input } = payload;
    const tenureLabel = pickString(input || {}, ['tenure_label_tr', 'tenureLabelTr', 'hizmet_suresi_label'], humanizeServiceDuration(derived.serviceDays));
    sectionTitle(doc, state, 'Girdi Özeti');
    const rows = [
      ['Ayrılış nedeni', reason?.label_tr || '-'],
      ['Hizmet süresi', tenureLabel],
      ['Aylık çıplak brüt ücret', formatMoney(derived.baseSalary)],
      ['Yemek yardımı', formatMoney(derived.yemek)],
      ['Yol yardımı', formatMoney(derived.yol)],
      ['Yakacak yardımı', `${formatMoney(derived.yakacakYearly)} / yıl (${formatMoney(derived.yakacakMonthly)} / ay)`],
      ['Giydirilmiş brüt ücret', formatMoney(calculation.giydirilmisBrut), 'bold'],
      ['Kıdem tavanı', formatMoney(calculation.tavan)]
    ];
    keyValueRows(doc, state, rows);
  }

  function drawBreakdown(doc, state, payload) {
    const { calculation } = payload;
    sectionTitle(doc, state, 'Hesap Dökümü');
    const rows = [
      ['Tavan uygulanmış aylık tutar', formatMoney(calculation.cappedMonthly), 'bold'],
      ['Brüt kıdem tazminatı', formatMoney(calculation.gross)],
      ['Damga vergisi', `-${formatMoney(calculation.stampTax)}`],
      ['Net kıdem tazminatı', formatMoney(calculation.net), 'bold']
    ];
    if (calculation.noticeWeeks > 0) {
      rows.push(['İhbar notu', `${formatInteger(calculation.noticeWeeks)} hafta - ${formatMoney(calculation.noticeGross)}`]);
    }
    keyValueRows(doc, state, rows);
  }

  function drawResultBlock(doc, state, payload) {
    const { calculation } = payload;
    ensureSpace(doc, state, 30);
    setFillColor(doc, COLORS.eligible);
    doc.roundedRect(state.marginX, state.y, state.width - state.marginX * 2, 24, 3, 3, 'F');
    text(doc, `Sonuç: ${formatMoney(calculation.net)}`, state.marginX + 6, state.y + 15, {
      size: 18,
      weight: 'bold',
      color: [255, 255, 255]
    });
    state.y += 36;
  }

  function drawLegalBasis(doc, state, data, payload) {
    const { eligibility } = payload;
    sectionTitle(doc, state, 'Yasal Dayanak');
    const basis = [
      eligibility.statuteCitation,
      data?.tavan?.source_citation || '',
      `Damga vergisi oranı: ${formatDecimal((data?.damga_vergisi_rate || 0) * 100, 3)}%`,
      'Ölüm halinde ödeme kanuni mirasçılara yapılır; veraset ilamı ile başvuru gerekir.'
    ].filter(Boolean).join('\n');
    const used = wrappedText(doc, basis, state.marginX, state.y, state.width - state.marginX * 2, {
      size: 9,
      color: COLORS.muted,
      lineHeight: 4.3
    });
    state.y += used + 8;
  }

  function drawNextSteps(doc, state, payload) {
    sectionTitle(doc, state, 'Sonraki Adımlar');
    const deathNote = payload.reason?.id === 'olum' ? ' Ölüm halinde veraset ilamı ve mirasçı bilgileri ayrıca hazırlanmalıdır.' : '';
    const copy = `İşverenle yazılı mutabakat sağlayın. Uyuşmazlık halinde dava öncesinde zorunlu arabuluculuk başvurusu gerekir. Bordro, banka dekontu, yan hak belgeleri ve fesih bildirimi gibi evrakları saklayın.${deathNote}`;
    const used = wrappedText(doc, copy, state.marginX, state.y, state.width - state.marginX * 2, {
      size: 10,
      lineHeight: 4.6
    });
    state.y += used + 8;
  }

  function drawFooter(doc, state, data, date) {
    ensureSpace(doc, state, 30);
    setDrawColor(doc, COLORS.border);
    doc.line(state.marginX, state.y, state.width - state.marginX, state.y);
    state.y += 8;
    const disclaimer = data?.pdf_config?.footer_disclaimer_tr || 'Bu tutanak bilgilendirme amaçlıdır; hukuki sonuç doğurmaz.';
    const used = wrappedText(doc, disclaimer, state.marginX, state.y, state.width - state.marginX * 2, {
      size: 8.5,
      color: COLORS.muted,
      lineHeight: 3.8
    });
    state.y += used + 6;
    text(doc, `Oluşturma zamanı: ${displayTimestamp(date)}`, state.marginX, state.y, { size: 8.5, color: COLORS.muted });
  }

  async function buildHesapTutanagi({ data, input, result, eligibility, generatedAt } = {}) {
    if (!data || typeof data !== 'object') {
      throw new Error('Asset7 PDF: data/asset7.json nesnesi zorunludur.');
    }
    if (!input || typeof input !== 'object') {
      throw new Error('Asset7 PDF: hesaplama girdisi zorunludur.');
    }

    const jsPDF = getJsPDFCtor();
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true
    });

    await registerFonts(doc);

    const date = generatedAt instanceof Date ? generatedAt : new Date();
    const payload = deriveCalculation(data, input, result, eligibility);
    const state = pageMetrics(doc);

    drawHeader(doc, state, data);
    drawVerdictBox(doc, state, payload);

    if (!payload.eligibility.eligible) {
      sectionTitle(doc, state, 'Hesaplama Durduruldu');
      wrappedText(doc, 'Uygunluk kararı olumsuz olduğu için kıdem tazminatı tutarı hesaplanmadı ve PDF içinde herhangi bir parasal sonuç üretilmedi.', state.marginX, state.y, state.width - state.marginX * 2, {
        size: 10,
        color: COLORS.amber,
        lineHeight: 4.5
      });
      state.y += 18;
      drawLegalBasis(doc, state, data, payload);
      drawFooter(doc, state, data, date);
      return doc;
    }

    drawInputSummary(doc, state, payload);
    drawBreakdown(doc, state, payload);
    drawResultBlock(doc, state, payload);
    drawLegalBasis(doc, state, data, payload);
    drawNextSteps(doc, state, payload);
    drawFooter(doc, state, data, date);

    return doc;
  }

  async function downloadHesapTutanagi(args) {
    const date = args?.generatedAt instanceof Date ? args.generatedAt : new Date();
    const doc = await buildHesapTutanagi({ ...args, generatedAt: date });
    doc.save(`kidem-tazminati-hesap-tutanagi-${filenameDate(date)}.pdf`);
    return doc;
  }

  async function blobHesapTutanagi(args) {
    const doc = await buildHesapTutanagi(args);
    return doc.output('blob');
  }

  async function runSmokeTest(data) {
    return blobHesapTutanagi({
      data,
      input: {
        base_salary_tl: 50000,
        yemek_tl: 3000,
        yol_tl: 2000,
        yakacak_yearly_tl: 6000,
        service_days: 1825,
        departure_reason_id: 'isveren_feshi'
      },
      generatedAt: new Date('2026-05-08T22:52:37+03:00')
    });
  }

  global.Asset7Pdf = Object.freeze({
    buildHesapTutanagi,
    downloadHesapTutanagi,
    blobHesapTutanagi,
    runSmokeTest,
    _deriveCalculationForTests: deriveCalculation
  });
})(window);
