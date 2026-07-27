import {
  Asset19Error,
  applicableReliefBenefits,
  buildScenario,
  buildUnknownRatioScenarios,
  calculateCollateralEstimate,
  compareIsoDates,
  findCategory,
  findDebtType,
  formatDateTR,
  formatKurusTR,
  parseMoneyToKurus,
  resolveTier,
  todayIsoLocal,
  validateRuntimeConfig
} from './asset19-core.js';
import { downloadAsset19Pdf } from './asset19-pdf.js';

const APEX_HOST = 'https://dogrusonuc.com';
const HERO_PATH = '/kamu-borcu-tecil-hesaplama.html';

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function readConfig() {
  const node = qs('#asset19-data');
  if (!node) throw new Error('asset19-data JSON bloğu bulunamadı.');
  const raw = node.textContent.replace(/<!-- ASSET19_JSON_START -->|<!-- ASSET19_JSON_END -->/g, '');
  return JSON.parse(raw);
}

function anchor(config, key, fallback = '') {
  const value = String(config.copy_anchors?.[key] || '').trim();
  return value || fallback;
}

function setText(selector, value) {
  qsa(selector).forEach((node) => { node.textContent = value; });
}

function interpolate(text, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), String(text || ''));
}

function interpolateOrAppend(text, values, suffixParts = []) {
  const source = String(text || '');
  const rendered = interpolate(source, values);
  const missing = suffixParts.filter(([token]) => !source.includes(`{${token}}`)).map(([, label, value]) => `${label}: ${value}`);
  return missing.length ? `${rendered} (${missing.join(' · ')})` : rendered;
}

function renderCountdown(config) {
  const deadlineIso = config.key_dates.application_deadline_date.value;
  const deadline = new Date(`${deadlineIso}T23:59:59+03:00`).getTime();
  const staticText = formatDateTR(deadlineIso);
  setText('[data-deadline-static]', staticText);
  setText('[data-countdown-label]', anchor(config, 'countdown_label_tr', 'Son başvuru süresi'));

  const tick = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      setText('[data-countdown-value]', 'Süre doldu');
      if (config.countdown_config.post_deadline_behavior_code === 'banner_and_continue') {
        const banner = qs('#postDeadlineBanner');
        if (banner) {
          banner.hidden = false;
          banner.textContent = anchor(config, 'post_deadline_banner_tr', 'Başvuru süresi sona erdi; hesaplayıcı yalnız bilgilendirme için açıktır.');
        }
      }
      return;
    }
    const minutes = Math.floor(remaining / 60_000);
    const days = Math.floor(minutes / 1_440);
    const hours = Math.floor((minutes % 1_440) / 60);
    const mins = minutes % 60;
    setText('[data-countdown-value]', `${days} gün ${hours} saat ${mins} dakika`);
    window.setTimeout(tick, 30_000);
  };
  tick();
}

function populateAboveFold(config) {
  const rate = config.program_parameters.tecil_faizi_annual_percent.value;
  const maxTier = Math.max(...config.tiers.map((tier) => tier.max_term_months));
  setText('[data-rate]', `%${String(rate).replace('.', ',')}`);
  setText('[data-max-tier]', `${maxTier} aya kadar`);
  setText('[data-max-tier-framing]', 'Yalnız belirlenen borçlu sınıfında; serbest plan seçimi değildir.');
  setText('[data-hero-verdict]', anchor(config, 'hero_verdict_string_tr', 'Borç türünüzü, vade durumunu ve borçlu statünüzü kontrol ederek tahmini ödeme planını görün.'));
}

function optionLabel(value, code, type) {
  return String(value || '').trim() || `[${type} etiketi bekleniyor: ${code}]`;
}

function populateForm(config) {
  const debtSelect = qs('#debtType');
  debtSelect.innerHTML = '<option value="">Borç türünü seçin</option>' + config.debt_types.map((debt) =>
    `<option value="${escapeHtml(debt.debt_type_code)}">${escapeHtml(debt.debt_type_label_tr)}</option>`
  ).join('');

  const categories = qs('#debtorCategories');
  categories.innerHTML = config.debtor_categories.map((category) => `
    <label class="fact-option">
      <input type="radio" name="debtor_category_code" value="${escapeHtml(category.category_code)}">
      <span><strong>${escapeHtml(optionLabel(category.category_label_tr, category.category_code, 'kategori'))}</strong>${category.eligibility_note_tr ? `<small>${escapeHtml(category.eligibility_note_tr)}</small>` : ''}</span>
    </label>
  `).join('');

  setText('[data-debtor-prompt]', anchor(config, 'debtor_category_prompt_tr', 'Borçlu olarak hangi durum size uyuyor?'));
  setText('[data-liquidity-prompt]', anchor(config, 'liquidity_ratio_prompt_tr', 'Bilançonuzdaki likidite oranı hangi aralıkta?'));
  setText('[data-application-date-prompt]', anchor(config, 'basvuru_tarihi_prompt_tr', 'Başvuru tarihini girin.'));
  setText('[data-installments-prompt]', anchor(config, 'requested_installments_prompt_tr', 'Belirlenen tavandan daha az taksit talep edebilirsiniz; daha fazlasını isteyemezsiniz.'));

  qsa('input[name="debtor_category_code"]').forEach((input) => input.addEventListener('change', () => {
    const category = findCategory(config, input.value);
    renderLiquidityOptions(category);
  }));

  qs('#vadeState').addEventListener('change', (event) => {
    qs('#vadeDateField').hidden = event.target.value !== 'biliyorum';
    qs('#vadeDate').required = event.target.value === 'biliyorum';
  });

  qs('#useToday').addEventListener('click', () => {
    qs('#applicationDate').value = todayIsoLocal();
  });
}

function renderLiquidityOptions(category) {
  const holder = qs('#liquidityField');
  if (category.resolution_mode !== 'liquidity_ratio') {
    holder.hidden = true;
    qs('#liquidityOptions').innerHTML = '';
    return;
  }
  holder.hidden = false;
  qs('#liquidityOptions').innerHTML = category.liquidity_brackets.map((bracket) => `
    <label class="fact-option">
      <input type="radio" name="liquidity_bracket_code" value="${escapeHtml(bracket.bracket_code)}">
      <span>${escapeHtml(optionLabel(bracket.bracket_label_tr, bracket.bracket_code, 'oran aralığı'))}</span>
    </label>
  `).join('') + `
    <label class="fact-option">
      <input type="radio" name="liquidity_bracket_code" value="bilmiyorum">
      <span>Bilmiyorum</span>
    </label>`;
}

function clearErrors() {
  qsa('[data-error-for]').forEach((node) => { node.textContent = ''; });
}

function showError(field, message) {
  const node = qs(`[data-error-for="${field}"]`);
  if (node) node.textContent = message;
}

function disableForIncomplete(config, issues) {
  const banner = qs('#integrationBanner');
  if (!banner) return;
  banner.hidden = false;
  banner.innerHTML = `<strong>Final JSON entegrasyonu bekleniyor.</strong><br>${escapeHtml(issues.filter((item) => item !== 'NO_DATA_SENTINEL').slice(0, 5).join(' · '))}`;
  const button = qs('#calculateButton');
  if (button) button.disabled = true;
  qsa('#asset19Calc input, #asset19Calc select, #asset19Calc button').forEach((node) => { node.disabled = true; });
}

function renderCorrective(config) {
  return `<div class="corrective-banner">${escapeHtml(anchor(config, 'corrective_banner_tr', '[corrective_banner_tr bekleniyor]'))}</div>`;
}

function renderCommonLegal(config) {
  return `<p class="legal-box">${escapeHtml(anchor(config, 'tax_office_discretion_disclaimer_tr', '[tax_office_discretion_disclaimer_tr bekleniyor]'))}</p>${renderCorrective(config)}`;
}

function renderOutOfScope({ config, debt, reason }) {
  const holder = qs('#result');
  holder.className = 'result-panel result-neutral';
  holder.innerHTML = `
    <div class="result-heading">
      <span class="eyebrow">Kapsam kontrolü</span>
      <h2>${escapeHtml(anchor(config, 'out_of_scope_verdict_tr', 'Bu borç kampanya kapsamında görünmüyor.'))}</h2>
    </div>
    <p>${escapeHtml(reason)}</p>
    <button class="button button-secondary" id="outScopePdf">Kapsam sonucu PDF’ini indir</button>
    ${renderCommonLegal(config)}
  `;
  qs('#outScopePdf').addEventListener('click', () => handlePdf({ variant: 'out_of_scope', debt, reason }, config));
  holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDiagnostic(config, key) {
  const holder = qs('#result');
  holder.className = 'result-panel result-diagnostic';
  holder.innerHTML = `<h2>Bu bilgi olmadan kapsam kararı verilemez</h2><p>${escapeHtml(anchor(config, key, `[${key} bekleniyor]`))}</p>`;
  holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderBenefits(config, debtCode) {
  const benefits = applicableReliefBenefits(config, debtCode);
  if (!benefits.length) return '';
  return `
    <section class="benefits">
      <h3>${escapeHtml(anchor(config, 'relief_benefits_header_tr', 'Tecil şartlarına uyulduğu sürece olası sonuçlar'))}</h3>
      ${benefits.map((benefit) => `
        <article>
          <h4>${escapeHtml(benefit.benefit_label_tr)}</h4>
          <p>${escapeHtml(benefit.benefit_description_tr)}</p>
        </article>
      `).join('')}
    </section>`;
}

function renderAmortizationTable(scenario) {
  return `
    <div class="table-scroll">
      <table class="amortization-table">
        <thead><tr><th>Taksit</th><th>Ödeme tarihi</th><th>Anapara</th><th>Tecil faizi</th><th>Taksit tutarı</th></tr></thead>
        <tbody>${scenario.amortization.rows.map((row) => `
          <tr>
            <td>${row.installmentNo}</td>
            <td>${formatDateTR(row.dueDate)}</td>
            <td>${formatKurusTR(row.principalKurus)}</td>
            <td>${formatKurusTR(row.interestKurus)}</td>
            <td><strong>${formatKurusTR(row.paymentKurus)}</strong></td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function scenarioMarkup(config, scenario, { details = false, id = '' } = {}) {
  const capNotice = scenario.capApplied
    ? `<p class="notice">${escapeHtml(anchor(config, 'kdv_bsmv_max_installment_notice_tr', '[kdv_bsmv_max_installment_notice_tr bekleniyor]'))}</p>`
    : scenario.publicDebtOverrideExempted
      ? `<p class="notice">${escapeHtml(anchor(config, 'kamu_statusu_all_debts_notice_tr', '[kamu_statusu_all_debts_notice_tr bekleniyor]'))}</p>`
      : '';
  const bracketPrefix = scenario.bracket?.bracket_label_tr ? `${scenario.bracket.bracket_label_tr} · ` : '';
  const title = `${bracketPrefix}${anchor(config, 'tier_scenario_header_tr', '')}${anchor(config, 'tier_scenario_header_tr', '') ? ' · ' : ''}${scenario.tier.tier_label_tr} · ${scenario.installmentCount} taksit`;
  const body = `
    <div class="scenario-framing">
      <strong>Tahmini sınıf — vergi dairesi tespitine tabidir.</strong>
      <p>${escapeHtml(scenario.tier.determination_framing_tr)}</p>
    </div>
    ${capNotice}
    <div class="summary-grid">
      <article><span>İlk taksit</span><strong>${formatKurusTR(scenario.amortization.first.paymentKurus)}</strong><small>${formatDateTR(scenario.amortization.first.dueDate)}</small></article>
      <article><span>Son taksit</span><strong>${formatKurusTR(scenario.amortization.last.paymentKurus)}</strong><small>${formatDateTR(scenario.amortization.last.dueDate)}</small></article>
      <article><span>Toplam geri ödeme</span><strong>${formatKurusTR(scenario.amortization.totalRepaymentKurus)}</strong><small>${scenario.installmentCount} taksit</small></article>
    </div>
    <div class="comparison">
      <div><span>${escapeHtml(anchor(config, 'comparison_today_label_tr', 'Bugün ödeme'))}</span><strong>${formatKurusTR(scenario.amortization.principalKurus)}</strong></div>
      <div><span>${escapeHtml(anchor(config, 'comparison_total_label_tr', 'Toplam geri ödeme'))}</span><strong>${formatKurusTR(scenario.amortization.totalRepaymentKurus)}</strong><small>Fark: ${formatKurusTR(scenario.amortization.totalInterestKurus)}</small></div>
    </div>
    ${renderAmortizationTable(scenario)}
    <button class="button" data-pdf-scenario="${escapeHtml(id)}">Bu plan görünümünü PDF indir</button>`;
  if (details) return `<details class="scenario-card"><summary>${escapeHtml(title)}</summary><div class="scenario-body">${body}</div></details>`;
  return `<section class="scenario-card scenario-open"><h2>${escapeHtml(title)}</h2><div class="scenario-body">${body}</div></section>`;
}

function renderResolved(config, scenario, collateralEstimate) {
  const holder = qs('#result');
  holder.className = 'result-panel result-success';
  holder.innerHTML = `
    <div class="result-heading"><span class="eyebrow">Kapsam ve sınıf sonucu</span><h2>${escapeHtml(anchor(config, 'in_scope_verdict_tr', 'Borç kapsamda görünüyor; tahmini plan aşağıdadır.'))}</h2></div>
    ${collateralEstimate ? `<p class="notice notice-collateral">${escapeHtml(interpolateOrAppend(anchor(config, 'above_collateral_threshold_notice_tr', 'Teminat tahmini'), { amount: formatKurusTR(collateralEstimate) }, [['amount','Tahmini teminat',formatKurusTR(collateralEstimate)]]))}</p>` : ''}
    ${scenarioMarkup(config, scenario, { id: 'resolved' })}
    ${renderBenefits(config, scenario.debt.debt_type_code)}
    ${renderCommonLegal(config)}
    <p class="fine-print">${escapeHtml(anchor(config, 'footer_disclaimer_tr', '[footer_disclaimer_tr bekleniyor]'))}</p>`;
  qs('[data-pdf-scenario="resolved"]').addEventListener('click', () => handlePdf({ variant: collateralEstimate ? 'above_collateral_threshold' : 'in_scope', debt: scenario.debt, scenario }, config));
  holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderUnknownRatio(config, debt, scenarioResults, collateralEstimate) {
  const holder = qs('#result');
  holder.className = 'result-panel result-diagnostic';
  holder.innerHTML = `
    <h2>Likidite oranı bilinmediği için tek bir sınıf belirlenemez</h2>
    <p>${escapeHtml(anchor(config, 'liquidity_ratio_unknown_diagnostic_tr', '[liquidity_ratio_unknown_diagnostic_tr bekleniyor]'))}</p>
    ${collateralEstimate ? `<p class="notice notice-collateral">${escapeHtml(interpolateOrAppend(anchor(config, 'above_collateral_threshold_notice_tr', 'Teminat tahmini'), { amount: formatKurusTR(collateralEstimate) }, [['amount','Tahmini teminat',formatKurusTR(collateralEstimate)]]))}</p>` : ''}
    <div class="scenario-list">
      ${scenarioResults.map((item, index) => item.status === 'valid'
        ? scenarioMarkup(config, item.scenario, { details: true, id: `unknown-${index}` })
        : `<details class="scenario-card"><summary>${escapeHtml(item.tier.tier_label_tr)}</summary><div class="scenario-body"><p class="field-error">${escapeHtml(interpolateOrAppend(anchor(config, 'installments_exceed_cap_error_tr', 'Bu sınıfta talep edilen taksit sayısı kullanılamaz.'), { cap: item.effectiveCap }, [['cap','Tavan',`${item.effectiveCap} taksit`]]))}</p></div></details>`
      ).join('')}
    </div>
    ${renderBenefits(config, debt.debt_type_code)}
    ${renderCommonLegal(config)}
    <p class="fine-print">${escapeHtml(anchor(config, 'footer_disclaimer_tr', '[footer_disclaimer_tr bekleniyor]'))}</p>`;
  scenarioResults.forEach((item, index) => {
    if (item.status !== 'valid') return;
    const button = qs(`[data-pdf-scenario="unknown-${index}"]`);
    button?.addEventListener('click', () => handlePdf({ variant: collateralEstimate ? 'above_collateral_threshold' : 'in_scope', debt, scenario: item.scenario }, config));
  });
  holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handlePdf(payload, config) {
  try {
    await downloadAsset19Pdf(payload, config, `${APEX_HOST}${HERO_PATH}`);
  } catch (error) {
    console.error(error);
    window.alert(`PDF oluşturulamadı: ${error.message}`);
  }
}

function handleSubmit(event, config) {
  event.preventDefault();
  clearErrors();
  const form = event.currentTarget;
  const data = new FormData(form);
  let principalKurus;
  try {
    principalKurus = parseMoneyToKurus(data.get('outstanding_amount_tl'));
  } catch (error) {
    showError('outstanding_amount_tl', error.message);
    return;
  }

  const debtCode = data.get('debt_type_code');
  if (!debtCode) return showError('debt_type_code', 'Borç türünü seçin.');
  const debt = findDebtType(config, debtCode);
  if (!debt.in_scope) {
    renderOutOfScope({ config, debt, reason: debt.out_of_scope_reason_tr });
    return;
  }

  const vadeState = data.get('vade_state');
  if (!vadeState) return showError('vade_state', 'Vade durumunu seçin.');
  if (vadeState === 'bilmiyorum') {
    renderDiagnostic(config, 'vade_unknown_diagnostic_tr');
    return;
  }
  const vadeDate = data.get('vade_date');
  if (!vadeDate) return showError('vade_date', 'Vade tarihini girin.');
  if (compareIsoDates(vadeDate, config.key_dates.debt_vade_cutoff_date.value) > 0) {
    renderOutOfScope({ config, debt, reason: anchor(config, 'vade_after_cutoff_verdict_tr', 'Bu vade tarihi kampanya kesim tarihinden sonra kalıyor.') });
    return;
  }

  const categoryCode = data.get('debtor_category_code');
  if (!categoryCode) return showError('debtor_category_code', 'Borçlu durumunuzu seçin.');
  const category = findCategory(config, categoryCode);
  const liquidityCode = category.resolution_mode === 'liquidity_ratio' ? data.get('liquidity_bracket_code') : '';
  if (category.resolution_mode === 'liquidity_ratio' && !liquidityCode) return showError('liquidity_bracket_code', 'Likidite oranı aralığını seçin.');

  const applicationDate = data.get('basvuru_tarihi');
  if (!applicationDate) return showError('basvuru_tarihi', 'Başvuru tarihini girin.');
  if (compareIsoDates(applicationDate, config.key_dates.application_deadline_date.value) > 0) {
    showError('basvuru_tarihi', anchor(config, 'basvuru_after_deadline_error_tr', 'Başvuru tarihi son başvuru tarihinden sonra olamaz.'));
    return;
  }
  const requested = data.get('requested_installments');
  const collateralEstimate = calculateCollateralEstimate(config, principalKurus);
  const thresholdKurus = parseMoneyToKurus(String(config.collateral.teminatsiz_threshold_tl.value));
  const probableMiskey = principalKurus > thresholdKurus * 100n;

  try {
    const resolution = resolveTier(config, categoryCode, liquidityCode);
    if (resolution.mode === 'unknown_ratio') {
      const scenarios = buildUnknownRatioScenarios({ config, debt, category, principalKurus, applicationDateIso: applicationDate, requestedInstallmentsRaw: requested });
      renderUnknownRatio(config, debt, scenarios, collateralEstimate);
      if (probableMiskey) qs('#result').insertAdjacentHTML('afterbegin', '<p class="notice">Girdiğiniz borç tutarı teminatsız tecil eşiğinin çok üzerindedir; yazım hatası olmadığını kontrol edin.</p>');
      return;
    }
    const scenario = buildScenario({ config, debt, category, tier: resolution.tier, bracket: resolution.bracket, principalKurus, applicationDateIso: applicationDate, requestedInstallmentsRaw: requested });
    renderResolved(config, scenario, collateralEstimate);
    if (probableMiskey) qs('#result').insertAdjacentHTML('afterbegin', '<p class="notice">Girdiğiniz borç tutarı teminatsız tecil eşiğinin çok üzerindedir; yazım hatası olmadığını kontrol edin.</p>');
  } catch (error) {
    if (error instanceof Asset19Error && error.code === 'INSTALLMENTS_EXCEED_CAP') {
      showError('requested_installments', interpolateOrAppend(anchor(config, 'installments_exceed_cap_error_tr', 'Talep edilen taksit sayısı geçerli tavanı aşıyor.'), { cap: error.details.effectiveCap }, [['cap','Tavan',`${error.details.effectiveCap} taksit`]]));
      return;
    }
    console.error(error);
    qs('#result').className = 'result-panel result-error';
    qs('#result').innerHTML = `<h2>Hesaplama durduruldu</h2><p>${escapeHtml(error.message)}</p>`;
  }
}

function initCalculator(config) {
  populateForm(config);
  qs('#asset19Calc').addEventListener('submit', (event) => handleSubmit(event, config));
}

function initLanding(config) {
  const cta = qs('#calculatorCta');
  if (cta) cta.href = HERO_PATH;
}

function init() {
  const config = readConfig();
  renderCountdown(config);
  populateAboveFold(config);
  setText('[data-footer-disclaimer]', anchor(config, 'footer_disclaimer_tr', 'Final yasal açıklama asset19.json üzerinden yüklenecektir.'));
  initLanding(config);

  if (document.body.dataset.page === 'calculator') {
    initCalculator(config);
    const issues = validateRuntimeConfig(config, { deployment: true });
    if (issues.length) {
      if (issues.includes('NO_DATA_SENTINEL')) {
        const banner = qs('#integrationBanner');
        banner.hidden = false;
        banner.textContent = anchor(config, 'no_data_banner_tr', 'Güncel program verisi hazır değil; hesaplama geçici olarak kapalı.');
      } else {
        disableForIncomplete(config, issues);
      }
    }
  }
}

try {
  init();
} catch (error) {
  console.error(error);
  document.body.insertAdjacentHTML('afterbegin', `<div class="system-banner">Yapılandırma okunamadı: ${escapeHtml(error.message)}</div>`);
}
