(function attachAsset22Render(global) {
  'use strict';

  const MONTHS_TR = Object.freeze(['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']);
  const MONEY_TOKENS = new Set([
    'kesinti_tl','refund_due_tuition_tl','tuition_bucket_tl','annual_tuition_tl',
    'ancillary_bucket_tl','prohibited_bucket_tl','amount_returned_by_school_tl',
    'total_paid_tl','reconciliation_shortfall_tl','difference_tl','esik_tutar_tl'
  ]);
  const DAY_TOKENS = new Set(['gecen_gun','kalan_gun']);
  const DATE_TOKENS = new Set(['ayrilis_tarihi','iade_son_tarihi','academic_year_start_date']);
  const TEXT_TOKENS = new Set(['exception_label_tr','institution_type_label_tr','academic_year_label_tr']);
  const PERCENT_TOKENS = new Set(['kesinti_yuzdesi']);
  const DURATION_TOKENS = new Set(['iade_suresi']);

  const ALLOWED_TOKENS = Object.freeze({
    seo_page_title_tr: ['kesinti_yuzdesi'],
    seo_meta_description_tr: ['kesinti_yuzdesi'],
    hero_intro_tr: ['kesinti_yuzdesi'],
    cancellation_notice_date_label_tr: [],
    cancellation_notice_date_helper_tr: [],
    annual_tuition_label_tr: [],
    institution_out_of_scope_verdict_tr: ['institution_type_label_tr'],
    pre_start_verdict_tr: ['kesinti_tl','refund_due_tuition_tl','annual_tuition_tl','tuition_bucket_tl','kesinti_yuzdesi'],
    pre_start_paid_below_kesinti_notice_tr: ['tuition_bucket_tl'],
    annual_tuition_missing_notice_tr: [],
    annual_tuition_below_paid_notice_tr: ['annual_tuition_tl','tuition_bucket_tl'],
    fee_items_pending_figures_withheld_notice_tr: [],
    full_refund_exception_verdict_tr: ['exception_label_tr','refund_due_tuition_tl'],
    post_start_state_label_tr: [],
    post_start_exact_calculation_unavailable_disclaimer_tr: [],
    ancillary_service_firewall_notice_tr: ['ancillary_bucket_tl'],
    fee_item_classification_unknown_diagnostic_tr: [],
    prohibited_fee_notice_tr: ['prohibited_bucket_tl'],
    statutory_deadline_late_notice_tr: ['ayrilis_tarihi','iade_suresi','iade_son_tarihi','gecen_gun'],
    statutory_deadline_within_window_notice_tr: ['ayrilis_tarihi','iade_suresi','iade_son_tarihi','kalan_gun'],
    statutory_deadline_unknown_notice_tr: [],
    reconciliation_difference_notice_pre_start_tr: ['refund_due_tuition_tl','amount_returned_by_school_tl','reconciliation_shortfall_tl'],
    reconciliation_difference_notice_post_start_tr: ['difference_tl','amount_returned_by_school_tl'],
    overpayment_return_notice_tr: ['amount_returned_by_school_tl','total_paid_tl'],
    evidence_checklist_intro_tr: [],
    weak_evidence_verbal_notice_only_tr: [],
    escalation_path_intro_tr: [],
    thh_referral_cta_tr: ['esik_tutar_tl'],
    thh_threshold_unknown_notice_tr: [],
    academic_year_stale_warning_tr: ['academic_year_label_tr','academic_year_start_date'],
    no_data_banner_tr: [],
    pdf_report_title_tr: [],
    pdf_footer_disclaimer_tr: [],
    share_card_title_tr: [],
    footer_disclaimer_tr: []
  });

  function groupIntegerDigits(digits) {
    return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatMoneyKurus(value) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError('Money formatter requires a non-negative integer kuruş value.');
    const whole = Math.floor(value / 100);
    const frac = value % 100;
    return `${groupIntegerDigits(whole)},${String(frac).padStart(2, '0')} TL`;
  }

  function formatDayCount(value) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError('Day-count formatter requires a non-negative integer.');
    return groupIntegerDigits(value);
  }

  function formatPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Percent formatter requires a non-negative finite number.');
    const pct = value * 100;
    const text = Number.isInteger(pct) ? String(pct) : String(pct).replace('.', ',');
    return `%${text}`;
  }

  function normalizeDateParts(value) {
    if (!value) throw new TypeError('Date token is undefined.');
    if (typeof value === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) throw new TypeError('Date token must be YYYY-MM-DD or {year,month,day}.');
      return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
    }
    if (Number.isInteger(value.year) && Number.isInteger(value.month) && Number.isInteger(value.day)) return value;
    throw new TypeError('Date token must be YYYY-MM-DD or {year,month,day}.');
  }

  function formatDateTr(value) {
    const p = normalizeDateParts(value);
    if (p.month < 1 || p.month > 12 || p.day < 1 || p.day > 31) throw new TypeError('Invalid date parts.');
    return `${p.day} ${MONTHS_TR[p.month - 1]} ${p.year}`;
  }

  function formatDuration(value) {
    if (!value || !Number.isInteger(value.count) || value.count < 1) throw new TypeError('Duration token requires positive integer count.');
    if (value.unit === 'calendar_month') return `${value.count} ay`;
    if (value.unit === 'calendar_day') return `${value.count} gün`;
    throw new TypeError('Unsupported duration unit.');
  }

  function formatToken(token, value) {
    if (value === undefined || value === null) throw new TypeError(`Token ${token} is undefined.`);
    if (MONEY_TOKENS.has(token)) return formatMoneyKurus(value);
    if (DAY_TOKENS.has(token)) return formatDayCount(value);
    if (DATE_TOKENS.has(token)) return formatDateTr(value);
    if (PERCENT_TOKENS.has(token)) return formatPercent(value);
    if (DURATION_TOKENS.has(token)) return formatDuration(value);
    if (TEXT_TOKENS.has(token)) {
      if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Text token ${token} is empty.`);
      return value;
    }
    throw new TypeError(`Unknown token ${token}.`);
  }

  function extractTokens(text) {
    const tokens = [];
    String(text || '').replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, token) => { tokens.push(token); return _; });
    return tokens;
  }

  function renderAnchorFromAnchors(anchors, key, context = {}, options = {}) {
    const value = anchors && anchors[key];
    if (typeof value !== 'string' || !value.trim()) {
      if (options.required) console.error(`[Asset22] Missing copy anchor: ${key}`);
      return null;
    }
    const allowed = new Set(ALLOWED_TOKENS[key] || []);
    try {
      for (const token of extractTokens(value)) {
        if (!allowed.has(token)) throw new TypeError(`Token ${token} is not allowed in ${key}.`);
      }
      const rendered = value.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, token) => formatToken(token, context[token]));
      if (/{{|}}/.test(rendered)) throw new TypeError(`Unresolved token in ${key}.`);
      return rendered;
    } catch (error) {
      console.error(`[Asset22] renderAnchor suppressed ${key}:`, error);
      return null;
    }
  }

  function createRenderer(config) {
    const anchors = config && config.copy_anchors ? config.copy_anchors : {};
    return function renderAnchor(key, context = {}, options = {}) {
      return renderAnchorFromAnchors(anchors, key, context, options);
    };
  }

  const api = Object.freeze({
    MONTHS_TR,
    ALLOWED_TOKENS,
    MONEY_TOKENS,
    DAY_TOKENS,
    formatMoneyKurus,
    formatDayCount,
    formatPercent,
    formatDateTr,
    formatDuration,
    formatToken,
    extractTokens,
    renderAnchorFromAnchors,
    createRenderer
  });

  global.Asset22Render = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
