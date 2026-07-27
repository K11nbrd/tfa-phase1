const DAY_MS = 86_400_000;
const INTEREST_DENOMINATOR = 3_600_000n;

export class Asset19Error extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'Asset19Error';
    this.code = code;
    this.details = details;
  }
}

export function parseIsoDateUTC(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Asset19Error('INVALID_DATE', 'Tarih YYYY-AA-GG biçiminde olmalıdır.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const date = new Date(epoch);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Asset19Error('INVALID_DATE', 'Geçersiz takvim tarihi.');
  }
  return { year, month, day, epoch, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

export function compareIsoDates(a, b) {
  return Math.sign(parseIsoDateUTC(a).epoch - parseIsoDateUTC(b).epoch);
}

export function formatDateTR(iso) {
  const { year, month, day } = parseIsoDateUTC(iso);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

export function isoFromUTCDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function todayIsoLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseMoneyToKurus(raw) {
  let value = String(raw ?? '').trim().replace(/\s+/g, '').replace(/₺|TL/gi, '');
  if (!value || value.startsWith('-')) throw new Asset19Error('INVALID_AMOUNT', 'Borç tutarı sıfırdan büyük olmalıdır.');
  if (!/^[0-9.,]+$/.test(value)) throw new Asset19Error('INVALID_AMOUNT', 'Borç tutarı yalnızca rakam ve ondalık ayırıcı içerebilir.');

  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  let decimalIndex = -1;
  if (comma >= 0 && dot >= 0) decimalIndex = Math.max(comma, dot);
  else if (comma >= 0) decimalIndex = value.length - comma - 1 <= 2 ? comma : -1;
  else if (dot >= 0) {
    const dotCount = (value.match(/\./g) || []).length;
    decimalIndex = dotCount === 1 && value.length - dot - 1 <= 2 ? dot : -1;
  }

  let integerPart;
  let fractionPart = '';
  if (decimalIndex >= 0) {
    integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, '');
    fractionPart = value.slice(decimalIndex + 1).replace(/[.,]/g, '');
  } else {
    integerPart = value.replace(/[.,]/g, '');
  }
  if (!integerPart) integerPart = '0';
  if (!/^\d+$/.test(integerPart) || (fractionPart && !/^\d{1,2}$/.test(fractionPart))) {
    throw new Asset19Error('INVALID_AMOUNT', 'Borç tutarı en fazla iki kuruş hanesi içermelidir.');
  }
  const kurus = BigInt(integerPart) * 100n + BigInt((fractionPart + '00').slice(0, 2));
  if (kurus <= 0n) throw new Asset19Error('INVALID_AMOUNT', 'Borç tutarı sıfırdan büyük olmalıdır.');
  return kurus;
}

export function formatKurusTR(kurus) {
  const value = typeof kurus === 'bigint' ? kurus : BigInt(kurus);
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const lira = abs / 100n;
  const cents = abs % 100n;
  const grouped = lira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped},${cents.toString().padStart(2, '0')} TL`;
}

export function decimalToFraction(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Asset19Error('INVALID_DECIMAL', 'JSON ondalık değeri geçersiz.');
  const [whole, fraction = ''] = text.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  return { numerator, denominator };
}

export function multiplyKurusByDecimalFloor(kurus, decimalValue) {
  const { numerator, denominator } = decimalToFraction(decimalValue);
  return BigInt(kurus) * numerator / denominator;
}

export function ratePercentToHundredths(ratePercent) {
  const scaled = Number(ratePercent) * 100;
  if (!Number.isFinite(scaled) || !Number.isInteger(scaled)) {
    throw new Asset19Error('INVALID_RATE', 'Tecil faizi yüzde değeri yüzdelik bazda tam sayı olmalıdır.');
  }
  return BigInt(scaled);
}

export function monthEndIso(year, monthOneBased) {
  const date = new Date(Date.UTC(year, monthOneBased, 0));
  return isoFromUTCDate(date);
}

export function addMonthsToYearMonth(year, monthOneBased, delta) {
  const zeroBased = monthOneBased - 1 + delta;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return { year: targetYear, month: targetMonth };
}

export function generateDueDates(config, installmentCount) {
  const n = Number(installmentCount);
  if (!Number.isInteger(n) || n < 1) throw new Asset19Error('INVALID_INSTALLMENT_COUNT', 'Taksit sayısı pozitif tam sayı olmalıdır.');
  const rule = config?.installment_schedule?.schedule_rule_code;
  if (rule !== 'ay_sonu_takvim') {
    throw new Asset19Error('UNSUPPORTED_SCHEDULE_RULE', `Desteklenmeyen veya boş ödeme takvimi kuralı: ${rule || 'boş'}`);
  }
  const anchor = parseIsoDateUTC(config.key_dates.first_installment_due_date.value);
  const dueDates = [];
  for (let index = 0; index < n; index += 1) {
    const target = addMonthsToYearMonth(anchor.year, anchor.month, index);
    dueDates.push(monthEndIso(target.year, target.month));
  }
  return dueDates;
}

export function inclusiveDayCount(startIso, endIso) {
  const start = parseIsoDateUTC(startIso).epoch;
  const end = parseIsoDateUTC(endIso).epoch;
  const diff = Math.floor((end - start) / DAY_MS) + 1;
  if (diff <= 0) throw new Asset19Error('INVALID_DAY_COUNT', 'Ödeme tarihi başvuru tarihinden sonra olmalıdır.');
  return diff;
}

export function splitPrincipal(principalKurus, installmentCount) {
  const principal = BigInt(principalKurus);
  const n = BigInt(installmentCount);
  if (principal <= 0n || n <= 0n) throw new Asset19Error('INVALID_PRINCIPAL_SPLIT', 'Anapara ve taksit sayısı pozitif olmalıdır.');
  const base = principal / n;
  const remainder = principal - base * n;
  const rows = Array(Number(n)).fill(base);
  // A1 (DC-verified, 2026 GİB guide): the indivisible remainder is added to the
  // FIRST installment, not the last.
  rows[0] = base + remainder;
  return rows;
}

export function calculateAmortization({ principalKurus, annualRatePercent, applicationDateIso, dueDates }) {
  const principal = BigInt(principalKurus);
  const dates = [...dueDates];
  if (!dates.length) throw new Asset19Error('EMPTY_SCHEDULE', 'Ödeme takvimi boş olamaz.');
  const principals = splitPrincipal(principal, dates.length);
  const r100 = ratePercentToHundredths(annualRatePercent);
  let previousDays = 0;
  let totalInterestKurus = 0n;

  const rows = dates.map((dueDate, index) => {
    const days = inclusiveDayCount(applicationDateIso, dueDate);
    if (days <= previousDays) throw new Asset19Error('NON_INCREASING_DAY_COUNT', 'Gün sayıları kesin olarak artmalıdır.');
    previousDays = days;
    const principalShareKurus = principals[index];
    const interestKurus = principalShareKurus * r100 * BigInt(days) / INTEREST_DENOMINATOR;
    const paymentKurus = principalShareKurus + interestKurus;
    totalInterestKurus += interestKurus;
    return {
      installmentNo: index + 1,
      dueDate,
      days,
      principalKurus: principalShareKurus,
      interestKurus,
      paymentKurus
    };
  });

  return {
    principalKurus: principal,
    installmentCount: rows.length,
    rows,
    first: rows[0],
    last: rows[rows.length - 1],
    totalInterestKurus,
    totalRepaymentKurus: principal + totalInterestKurus
  };
}

export function findDebtType(config, code) {
  const debt = config.debt_types.find((item) => item.debt_type_code === code);
  if (!debt) throw new Asset19Error('UNKNOWN_DEBT_TYPE', 'Borç türü JSON içinde bulunamadı.');
  return debt;
}

export function findCategory(config, code) {
  const category = config.debtor_categories.find((item) => item.category_code === code);
  if (!category) throw new Asset19Error('UNKNOWN_CATEGORY', 'Borçlu kategorisi JSON içinde bulunamadı.');
  return category;
}

export function findTier(config, code) {
  const tier = config.tiers.find((item) => item.tier_code === code);
  if (!tier) throw new Asset19Error('UNKNOWN_TIER', 'Taksit sınıfı JSON içinde bulunamadı.');
  return tier;
}

export function resolveTier(config, debtorCategoryCode, liquidityBracketCode = '') {
  const category = findCategory(config, debtorCategoryCode);
  if (category.resolution_mode === 'fixed_tier') {
    return { mode: 'resolved', category, tier: findTier(config, category.fixed_tier_code), bracket: null };
  }
  if (category.resolution_mode !== 'liquidity_ratio') {
    throw new Asset19Error('UNKNOWN_RESOLUTION_MODE', 'Borçlu kategorisi çözümleme modu desteklenmiyor.');
  }
  if (liquidityBracketCode === 'bilmiyorum') return { mode: 'unknown_ratio', category };
  const bracket = category.liquidity_brackets.find((item) => item.bracket_code === liquidityBracketCode);
  if (!bracket) throw new Asset19Error('UNKNOWN_LIQUIDITY_BRACKET', 'Likidite oranı aralığı seçilmelidir.');
  return { mode: 'resolved', category, tier: findTier(config, bracket.tier_code), bracket };
}

export function effectiveInstallmentCap(category, debt, tier) {
  if (category.exempt_from_max_installment_override) return tier.max_term_months;
  if (debt.max_installment_override?.applies) return Math.min(tier.max_term_months, debt.max_installment_override.months);
  return tier.max_term_months;
}

export function parseRequestedInstallments(raw, effectiveCap) {
  const text = String(raw ?? '').trim();
  if (!text) return effectiveCap;
  if (!/^\d+$/.test(text)) throw new Asset19Error('INVALID_REQUESTED_INSTALLMENTS', 'Taksit sayısı tam sayı olmalıdır.', { effectiveCap });
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1 || value > effectiveCap) {
    throw new Asset19Error('INSTALLMENTS_EXCEED_CAP', 'Talep edilen taksit sayısı geçerli tavanı aşıyor.', { effectiveCap });
  }
  return value;
}

export function buildScenario({ config, debt, category, tier, bracket = null, principalKurus, applicationDateIso, requestedInstallmentsRaw }) {
  const effectiveCap = effectiveInstallmentCap(category, debt, tier);
  const installmentCount = parseRequestedInstallments(requestedInstallmentsRaw, effectiveCap);
  const dueDates = generateDueDates(config, installmentCount);
  const amortization = calculateAmortization({
    principalKurus,
    annualRatePercent: config.program_parameters.tecil_faizi_annual_percent.value,
    applicationDateIso,
    dueDates
  });
  return {
    debt,
    category,
    tier,
    bracket,
    effectiveCap,
    installmentCount,
    capApplied: effectiveCap < tier.max_term_months,
    publicDebtOverrideExempted: Boolean(category.exempt_from_max_installment_override && debt.max_installment_override?.applies),
    amortization
  };
}

export function buildUnknownRatioScenarios({ config, debt, category, principalKurus, applicationDateIso, requestedInstallmentsRaw }) {
  const seenCaps = new Set();
  const scenarios = [];
  for (const bracket of category.liquidity_brackets) {
    const tier = findTier(config, bracket.tier_code);
    const cap = effectiveInstallmentCap(category, debt, tier);
    if (seenCaps.has(cap)) continue;
    seenCaps.add(cap);
    try {
      scenarios.push({
        status: 'valid',
        scenario: buildScenario({ config, debt, category, tier, bracket, principalKurus, applicationDateIso, requestedInstallmentsRaw })
      });
    } catch (error) {
      if (error instanceof Asset19Error && error.code === 'INSTALLMENTS_EXCEED_CAP') {
        scenarios.push({ status: 'invalid_requested_installments', tier, bracket, effectiveCap: cap, error });
      } else {
        throw error;
      }
    }
  }
  return scenarios;
}

export function applicableReliefBenefits(config, debtTypeCode) {
  return config.relief_benefits.filter((benefit) => benefit.applies_to_debt_type_codes.includes(debtTypeCode));
}

export function calculateCollateralEstimate(config, principalKurus) {
  const threshold = parseMoneyToKurus(String(config.collateral.teminatsiz_threshold_tl.value));
  if (principalKurus <= threshold) return null;
  const excess = principalKurus - threshold;
  return multiplyKurusByDecimalFloor(excess, config.collateral.excess_collateral_ratio.value);
}

export function validateRuntimeConfig(config, { deployment = false } = {}) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const rate = config?.program_parameters?.tecil_faizi_annual_percent?.value;
  if (rate === 0) return ['NO_DATA_SENTINEL'];
  require(Number.isFinite(rate) && rate > 0 && rate < 100, 'tecil_faizi_annual_percent.value 0–100 arasında olmalıdır.');
  require(Number.isInteger(rate * 100), 'tecil faizi × 100 tam sayı olmalıdır.');
  require(config.program_parameters.cari_tecil_faizi_annual_percent.value >= rate, 'Cari tecil faizi kampanya faizinden düşük olamaz.');
  require(config.program_parameters.day_count_convention.days_per_month === 0, 'days_per_month sabit 0 sentinel olmalıdır.');
  require(config.program_parameters.day_count_convention.days_per_year === 360, 'days_per_year 360 olmalıdır.');
  require(config.amortization_model.method_code === 'esit_anapara_basit_faiz', 'Amortisman yöntemi eşit anapara + basit faiz olmalıdır.');
  require(config.amortization_model.day_count_basis_code === 'gercek_gun_odeme_gunu_dahil', 'Gün sayımı gerçek gün / ödeme günü dahil olmalıdır.');
  require(config.amortization_model.rounding_rule_code === 'kurus_asagi_kesme', 'Kuruş aşağı kesme kuralı zorunludur.');
  require(config.installment_schedule.schedule_rule_code === 'ay_sonu_takvim', 'Ödeme takvimi ay sonu takvim kuralı olmalıdır.');
  require(Array.isArray(config.tiers) && config.tiers.length === 3, 'tiers[] tam 3 kayıt olmalıdır.');
  if (Array.isArray(config.tiers)) {
    require(config.tiers.every((tier) => tier.is_default_tier === false), 'Hiçbir tier varsayılan olamaz.');
    require(config.tiers.every((tier, index, array) => index === 0 || tier.max_term_months > array[index - 1].max_term_months), 'Tier vadeleri kesin artmalıdır.');
  }
  require(Array.isArray(config.debtor_categories) && config.debtor_categories.length === 3, 'debtor_categories[] tam 3 kayıt olmalıdır.');
  if (Array.isArray(config.debtor_categories)) {
    require(new Set(config.debtor_categories.map((item) => item.category_code)).size === 3, 'Borçlu kategori kodları benzersiz olmalıdır.');
    require(config.debtor_categories.filter((item) => item.exempt_from_max_installment_override).length === 1, 'Yalnız kamu statüsü override muafiyetine sahip olmalıdır.');
  }
  const dates = ['debt_vade_cutoff_date', 'application_deadline_date', 'first_installment_due_date'].map((key) => config.key_dates?.[key]?.value);
  try {
    dates.forEach(parseIsoDateUTC);
    require(compareIsoDates(dates[0], dates[1]) < 0 && compareIsoDates(dates[1], dates[2]) < 0, 'Tarih sırası cutoff < deadline < ilk taksit olmalıdır.');
  } catch (error) {
    errors.push(error.message);
  }
  require(config.collateral.teminatsiz_threshold_tl.value > 0, 'Teminatsız eşik pozitif olmalıdır.');
  require(config.collateral.excess_collateral_ratio.value > 0 && config.collateral.excess_collateral_ratio.value <= 1, 'Teminat oranı 0–1 aralığında olmalıdır.');
  require(config.amortization_model.verified_against_gib_example === true, 'GİB örneği doğrulama işareti true olmalıdır.');

  const launchAnchors = [
    'corrective_banner_tr',
    'tax_office_discretion_disclaimer_tr',
    'liquidity_ratio_unknown_diagnostic_tr',
    'installments_exceed_cap_error_tr',
    'kamu_statusu_all_debts_notice_tr'
  ];
  if (deployment) {
    require(config.debtor_categories.every((item) => item.category_label_tr && (item.liquidity_brackets || []).every((bracket) => bracket.bracket_label_tr)), 'Kategori ve likidite etiketleri dolu olmalıdır.');
    require(launchAnchors.every((key) => String(config.copy_anchors[key] || '').trim()), 'Launch-blocking copy anchor alanları dolu olmalıdır.');
    require(Object.values(config.copy_anchors).every((value) => String(value || '').trim()), 'Tüm copy_anchors alanları dolu olmalıdır.');
    require(config.amortization_model.worked_example_fixture.available === true, 'Worked-example fixture launchta hazır olmalıdır.');
    require(config.pdf_card_config.page_dimensions_mm.width > 0 && config.pdf_card_config.page_dimensions_mm.height > 0, 'PDF boyutları dolu olmalıdır.');
    require(String(config.pdf_card_config.filename_pattern || '').trim(), 'PDF filename_pattern dolu olmalıdır.');
    require(Array.isArray(config.pdf_card_config.section_order) && config.pdf_card_config.section_order.length > 0, 'PDF section_order dolu olmalıdır.');
  }
  return errors;
}
