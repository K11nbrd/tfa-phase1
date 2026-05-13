import {todayStamp} from './config-loader.js';

function legacyToAdapterPayload(result) {
  return {
    input: {
      departure_reason_label_tr: (result.inputLines && result.inputLines[0] || '').replace(/^Ayrılış:\s*/, '') || '-',
      tenure_label_tr: '-',
      base_salary_tl: undefined,
      food_allowance_tl: undefined,
      transport_allowance_tl: undefined,
      fuel_allowance_monthly_tl: undefined
    },
    result: {
      eligible: true,
      verdict_text_tr: result.verdictText || '-',
      statute_citation: result.statute || '-',
      next_steps_tr: 'Arabuluculuk başvurusu ve iş hukuku danışmanlığı önerilir.'
    },
    eligibility: {
      eligible: true,
      verdict_text_tr: result.verdictText || '-',
      statute_citation: result.statute || '-'
    }
  };
}

function normalizeForBlankFixAdapter(payload, config) {
  const normalized = payload && payload.input && payload.result ? payload : legacyToAdapterPayload(payload || {});
  const input = normalized.input || {};
  const result = normalized.result || {};
  const eligibility = normalized.eligibility || {
    eligible: result.eligible === true,
    verdict_text_tr: result.verdict_text_tr || '-',
    statute_citation: result.statute_citation || '-'
  };

  return {
    data: config,
    input: {
      ...input,
      departure_reason_id: input.departure_reason_id || input.departure_reason,
      departure_reason: input.departure_reason || input.departure_reason_id,
      service_days: input.service_days || input.tenure_days,
      service_years: input.service_years || input.service_multiplier,
      service_multiplier: input.service_multiplier || input.service_years,
      yemek_tl: input.yemek_tl ?? input.food_allowance_tl,
      yol_tl: input.yol_tl ?? input.transport_allowance_tl,
      yakacak_monthly_tl: input.yakacak_monthly_tl ?? input.fuel_allowance_monthly_tl,
      yakacak_yearly_tl: input.yakacak_yearly_tl ?? (typeof input.fuel_allowance_monthly_tl === 'number' ? input.fuel_allowance_monthly_tl * 12 : undefined)
    },
    result: {
      ...result,
      giydirilmis_brut: result.giydirilmis_brut ?? result.giydirilmis_ucret_tl,
      capped_monthly: result.capped_monthly ?? result.capped_monthly_tl,
      gross_kidem: result.gross_kidem ?? result.gross_kidem_tl,
      damga_vergisi: result.damga_vergisi ?? result.damga_vergisi_tl,
      net_kidem: result.net_kidem ?? result.net_kidem_tl,
      notice_weeks: result.notice_weeks,
      ihbar_gross: result.ihbar_gross
    },
    eligibility,
    generatedAt: new Date()
  };
}

export async function asset7Pdf(payload, config){
  if (!window.Asset7Pdf || !window.Asset7Pdf.downloadHesapTutanagi) {
    throw new Error('Asset7Pdf yüklenemedi. shared/js/asset7-pdf-adapter.js ve yerel jsPDF dosyasını kontrol edin.');
  }
  const args = normalizeForBlankFixAdapter(payload, config);
  if (!args.eligibility || args.eligibility.eligible !== true) {
    throw new Error('Uygunluk kararı olumsuz olduğu için hesap tutanağı üretilemez.');
  }
  return window.Asset7Pdf.downloadHesapTutanagi(args);
}

export function expectedAsset7PdfFilename(){
  return `kidem-tazminati-hesap-tutanagi-${todayStamp()}.pdf`;
}
