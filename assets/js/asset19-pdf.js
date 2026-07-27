import { applicableReliefBenefits, formatDateTR, formatKurusTR } from './asset19-core.js';

const FONT_REGULAR_URL = 'assets/fonts/Roboto-Regular.ttf';
const FONT_BOLD_URL = 'assets/fonts/Roboto-Bold.ttf';

let fontsPromise;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function loadRoboto(doc) {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetch(FONT_REGULAR_URL).then((response) => {
        if (!response.ok) throw new Error(`Roboto-Regular.ttf bulunamadı (${response.status}).`);
        return response.arrayBuffer();
      }),
      fetch(FONT_BOLD_URL).then((response) => {
        if (!response.ok) throw new Error(`Roboto-Bold.ttf bulunamadı (${response.status}).`);
        return response.arrayBuffer();
      })
    ]);
  }
  const [regular, bold] = await fontsPromise;
  doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regular));
  doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(bold));
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

function writeWrapped(doc, text, x, y, width, { fontSize = 7, style = 'normal', lineHeight = 1.2 } = {}) {
  doc.setFont('Roboto', style);
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text || ''), width);
  doc.text(lines, x, y);
  return y + lines.length * fontSize * 0.3528 * lineHeight;
}

function safeAnchor(config, key, fallback = '') {
  return String(config.copy_anchors?.[key] || fallback);
}

function buildFilename(pattern, payload) {
  if (!String(pattern || '').trim()) throw new Error('pdf_card_config.filename_pattern boş. Final JSON entegrasyonu gerekli.');
  return String(pattern)
    .replaceAll('{date}', new Date().toISOString().slice(0, 10).replaceAll('-', ''))
    .replaceAll('{debt_type}', payload.debt.debt_type_code)
    .replaceAll('{variant}', payload.variant)
    .replaceAll('{installments}', String(payload.scenario?.installmentCount || ''));
}

export async function downloadAsset19Pdf(payload, config, apexUrl) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('jsPDF binary bulunamadı. vendor/jspdf.umd.min.js assembly sırasında kopyalanmalıdır.');
  const width = Number(config.pdf_card_config.page_dimensions_mm.width);
  const height = Number(config.pdf_card_config.page_dimensions_mm.height);
  if (!(width > 0 && height > 0)) throw new Error('PDF sayfa ölçüleri final JSON içinde doldurulmalıdır.');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [width, height], compress: true });
  await loadRoboto(doc);
  doc.setFont('Roboto', 'normal');

  const margin = 10;
  const usable = width - margin * 2;
  const footerTop = height - 28;
  const bannerTop = footerTop - 20;
  let y = 11;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(13);
  doc.text(safeAnchor(config, 'pdf_card_title_tr', 'Taksit Planı Kartı'), margin, y);
  y += 6;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Oluşturma tarihi: ${new Date().toLocaleDateString('tr-TR')}`, margin, y);
  y += 4;
  doc.text(`Borç türü: ${payload.debt.debt_type_label_tr}`, margin, y);
  y += 6;

  if (payload.variant === 'out_of_scope') {
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10);
    doc.text(safeAnchor(config, 'out_of_scope_verdict_tr', 'Bu borç bu kapsamda görünmüyor.'), margin, y);
    y += 5;
    y = writeWrapped(doc, payload.reason, margin, y, usable, { fontSize: 7.5 });
    y += 4;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(7);
    doc.text(`Son başvuru: ${formatDateTR(config.key_dates.application_deadline_date.value)}`, margin, y);
  } else {
    const { scenario } = payload;
    doc.setFillColor(242, 245, 247);
    doc.roundedRect(margin, y, usable, 28, 2, 2, 'F');
    y += 5;
    y = writeWrapped(doc, `${scenario.tier.tier_label_tr} · Uygulanan taksit: ${scenario.installmentCount}`, margin + 4, y, usable - 8, { fontSize: 8.5, style: 'bold' });
    y = writeWrapped(doc, `${scenario.tier.determination_framing_tr} Tahmini sınıf; vergi dairesi tespitine tabidir.`, margin + 4, y + 1, usable - 8, { fontSize: 6.3 });
    y += 4;

    const summary = [
      ['İlk taksit', `${formatDateTR(scenario.amortization.first.dueDate)} · ${formatKurusTR(scenario.amortization.first.paymentKurus)}`],
      ['Son taksit', `${formatDateTR(scenario.amortization.last.dueDate)} · ${formatKurusTR(scenario.amortization.last.paymentKurus)}`],
      ['Toplam geri ödeme', formatKurusTR(scenario.amortization.totalRepaymentKurus)]
    ];
    for (const [label, value] of summary) {
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(7);
      doc.text(label, margin, y);
      doc.setFont('Roboto', 'normal');
      doc.text(value, margin + 38, y);
      y += 4.5;
    }
    if (scenario.capApplied) {
      y = writeWrapped(doc, safeAnchor(config, 'kdv_bsmv_max_installment_notice_tr'), margin, y + 1, usable, { fontSize: 6.2, style: 'bold' });
    } else if (scenario.publicDebtOverrideExempted) {
      y = writeWrapped(doc, safeAnchor(config, 'kamu_statusu_all_debts_notice_tr'), margin, y + 1, usable, { fontSize: 6.2, style: 'bold' });
    }

    doc.setDrawColor(185);
    doc.line(margin, y + 1, width - margin, y + 1);
    y += 5;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(7);
    doc.text(safeAnchor(config, 'comparison_today_label_tr', 'Bugün ödeme'), margin, y);
    doc.text(formatKurusTR(scenario.amortization.principalKurus), width - margin, y, { align: 'right' });
    y += 4;
    doc.text(safeAnchor(config, 'comparison_total_label_tr', 'Toplam geri ödeme'), margin, y);
    doc.text(formatKurusTR(scenario.amortization.totalRepaymentKurus), width - margin, y, { align: 'right' });
    y += 4;
    doc.setFont('Roboto', 'normal');
    doc.text(`Toplam tecil faizi: ${formatKurusTR(scenario.amortization.totalInterestKurus)}`, margin, y);
    y += 5;
    doc.text(`Son başvuru: ${formatDateTR(config.key_dates.application_deadline_date.value)}`, margin, y);
    y += 5;

    const benefits = applicableReliefBenefits(config, payload.debt.debt_type_code);
    if (benefits.length) {
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(7.2);
      doc.text(safeAnchor(config, 'relief_benefits_header_tr', 'Tecil uyumlu kaldıkça olası sonuçlar'), margin, y);
      y += 4;
      const bodySize = benefits.length >= 3 ? 5.1 : 5.7;
      const labelSize = benefits.length >= 3 ? 5.6 : 6.2;
      for (const benefit of benefits) {
        y = writeWrapped(doc, `• ${benefit.benefit_label_tr}`, margin, y, usable, { fontSize: labelSize, style: 'bold', lineHeight: 1.0 });
        y = writeWrapped(doc, benefit.benefit_description_tr, margin + 3, y, usable - 3, { fontSize: bodySize, lineHeight: 1.0 });
        y += 1.5;
      }
    }
  }

  doc.setFillColor(255, 241, 204);
  doc.roundedRect(margin, bannerTop, usable, 16, 2, 2, 'F');
  writeWrapped(doc, safeAnchor(config, 'corrective_banner_tr'), margin + 4, bannerTop + 5, usable - 8, { fontSize: 7, style: 'bold', lineHeight: 1.05 });

  let fy = footerTop;
  fy = writeWrapped(doc, safeAnchor(config, 'pdf_footer_disclaimer_tr'), margin, fy, usable, { fontSize: 5.5, lineHeight: 1.05 });
  fy = writeWrapped(doc, safeAnchor(config, 'tax_office_discretion_disclaimer_tr'), margin, fy + 1, usable, { fontSize: 5.5, style: 'bold', lineHeight: 1.05 });
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(5.5);
  doc.text(apexUrl, margin, height - 5);

  doc.save(buildFilename(config.pdf_card_config.filename_pattern, payload));
}
