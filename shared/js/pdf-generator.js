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
    }
  };
}

export async function asset7Pdf(payload, config){
  if (!window.Asset7PdfAdapter || !window.Asset7PdfAdapter.downloadKidemTazminatiPdf) {
    throw new Error('Asset7PdfAdapter yüklenemedi. shared/js/asset7-pdf-adapter.js ve yerel jsPDF dosyasını kontrol edin.');
  }
  const normalized = payload && payload.input && payload.result ? payload : legacyToAdapterPayload(payload || {});
  return window.Asset7PdfAdapter.downloadKidemTazminatiPdf({
    config,
    input: normalized.input,
    result: normalized.result,
    generatedAt: new Date()
  });
}

export function expectedAsset7PdfFilename(){
  return `kidem-tazminati-hesap-tutanagi-${todayStamp()}.pdf`;
}