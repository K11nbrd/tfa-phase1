(function attachAsset22Engine(global) {
  'use strict';

  const UNCERTAIN_CATEGORY_CODE = '__uncertain__';
  const DEADLINE_BOUNDARY_DAYS = 7;
  const APPLIES_TO = new Set(['pre_start', 'post_start', 'both']);
  const PERIOD_UNITS = new Set(['calendar_month', 'calendar_day']);

  function moneyToKurus(value) {
    if (value === '' || value === undefined || value === null) return null;
    const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function parseIsoParts(iso) {
    if (typeof iso !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const p = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
    if (p.month < 1 || p.month > 12 || p.day < 1 || p.day > daysInMonth(p.year, p.month)) return null;
    return p;
  }

  function isoFromParts(p) {
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, month) {
    const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return lengths[month - 1] || 0;
  }

  // Howard Hinnant-style civil-date ordinal; integer arithmetic only, DST-safe.
  function daysFromCivil(p) {
    let y = p.year;
    const m = p.month;
    const d = p.day;
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor(y / 400);
    const yoe = y - era * 400;
    const mp = m + (m > 2 ? -3 : 9);
    const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe;
  }

  function civilFromDays(z) {
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    let y = yoe + era * 400;
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    y += m <= 2 ? 1 : 0;
    return { year: y, month: m, day: d };
  }

  function compareParts(a, b) {
    return daysFromCivil(a) - daysFromCivil(b);
  }

  function addCalendarMonths(start, count) {
    const total = start.year * 12 + (start.month - 1) + count;
    const year = Math.floor(total / 12);
    const month = total - year * 12 + 1;
    return { year, month, day: Math.min(start.day, daysInMonth(year, month)) };
  }

  function addCalendarDays(start, count) {
    return civilFromDays(daysFromCivil(start) + count);
  }

  function localTodayParts(now = new Date()) {
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }

  function computeAcademicYearEffectiveUntil(startIso) {
    const start = parseIsoParts(startIso);
    if (!start) return null;
    return isoFromParts(addCalendarDays({ year: start.year + 1, month: start.month, day: start.day }, -1));
  }

  function classifyFeeItems(config, feeItems) {
    const byCode = new Map((config.fee_classification || []).map(item => [item.category_code, item]));
    const rows = [];
    let tuitionBucketKurus = 0;
    let ancillaryBucketKurus = 0;
    let prohibitedBucketKurus = 0;
    let totalPaidKurus = 0;
    let hasPendingRows = false;
    let hasInvalidRows = false;

    for (const sourceRow of feeItems || []) {
      const amountKurus = moneyToKurus(sourceRow.amount_tl);
      const categoryCode = sourceRow.category_code;
      const lookup = byCode.get(categoryCode) || null;
      let bucket = 'pending';
      if (!Number.isInteger(amountKurus) || amountKurus <= 0) {
        rows.push({ ...sourceRow, amountKurus, bucket: 'invalid', lookup });
        hasInvalidRows = true;
        continue;
      }
      totalPaidKurus += amountKurus;
      if (!lookup || categoryCode === UNCERTAIN_CATEGORY_CODE) {
        hasPendingRows = true;
      } else if (lookup.governed_by === 'tuition_refund_rule') {
        bucket = 'tuition';
        tuitionBucketKurus += amountKurus;
      } else if (lookup.governed_by === 'ancillary_service_separate_contract') {
        bucket = 'ancillary';
        ancillaryBucketKurus += amountKurus;
      } else if (lookup.governed_by === 'prohibited_fee') {
        bucket = 'prohibited';
        prohibitedBucketKurus += amountKurus;
      } else {
        hasPendingRows = true;
      }
      rows.push({ ...sourceRow, amountKurus, bucket, lookup });
    }

    return {
      rows,
      tuitionBucketKurus,
      ancillaryBucketKurus,
      prohibitedBucketKurus,
      totalPaidKurus,
      hasPendingRows,
      hasInvalidRows
    };
  }

  // Step 6b — the ONLY engine function that reads the annual-tuition input.
  function resolvePreStartStep6b(config, input, tuitionBucketKurus, hasPendingRows) {
    if (hasPendingRows) return { kind: 'figures_withheld_pending' }; // 6b.0 / E14
    if (tuitionBucketKurus === 0) return { kind: 'pre_start_e13_no_tuition' }; // 6b.1
    const annualTuitionKurus = moneyToKurus(input.annual_tuition_tl); // only engine read of annual_tuition_tl
    if (!Number.isInteger(annualTuitionKurus) || annualTuitionKurus === 0) return { kind: 'pre_start_e10_annual_missing' }; // 6b.2
    if (annualTuitionKurus < tuitionBucketKurus) {
      return { kind: 'pre_start_e12_annual_below_paid', annualTuitionKurus, tuitionBucketKurus }; // 6b.3
    }
    const rate = Number(config.pre_start_cancellation?.kesinti_yuzdesi?.value || 0);
    if (!(rate > 0 && rate < 1)) return { kind: 'no_data' };
    const kBpRaw = rate * 10000;
    if (!Number.isInteger(kBpRaw)) return { kind: 'config_invalid_basis_points' };
    const kBp = Math.round(kBpRaw);
    const kesintiKurus = Math.floor((annualTuitionKurus * kBp) / 10000); // 6b.4
    if (tuitionBucketKurus < kesintiKurus) {
      return { kind: 'pre_start_e11_paid_below_kesinti', refundDueTuitionKurus: 0, tuitionBucketKurus };
    }
    return {
      kind: 'pre_start_deterministic',
      annualTuitionKurus,
      kesintiKurus,
      refundDueTuitionKurus: tuitionBucketKurus - kesintiKurus,
      tuitionBucketKurus,
      deductionRate: rate
    }; // 6b.5
  }

  function usableDeadline(entry) {
    return Boolean(entry && APPLIES_TO.has(entry.applies_to) && entry.start_event === 'ayrilis_tarihi' &&
      Number.isInteger(entry.period_count) && entry.period_count >= 1 && PERIOD_UNITS.has(entry.period_unit));
  }

  function resolveDeadline(config, branch, departureParts, todayParts) {
    const candidates = (config.statutory_refund_deadlines || []).filter(entry => {
      if (!usableDeadline(entry)) return false;
      if (branch === null) return entry.applies_to === 'both';
      return entry.applies_to === branch || entry.applies_to === 'both';
    });
    if (candidates.length === 0) return { status: 'unknown', reason: 'no_usable_deadline', matched: null };
    if (candidates.length > 1) return { status: 'configuration_error', reason: 'multiple_usable_deadlines', matched: null };
    const matched = candidates[0];
    const due = matched.period_unit === 'calendar_month'
      ? addCalendarMonths(departureParts, matched.period_count)
      : addCalendarDays(departureParts, matched.period_count);
    const elapsedDays = daysFromCivil(todayParts) - daysFromCivil(departureParts);
    const deltaFromDue = daysFromCivil(todayParts) - daysFromCivil(due);
    const base = {
      matched,
      dueDateParts: due,
      dueDateIso: isoFromParts(due),
      elapsedDays,
      period: { count: matched.period_count, unit: matched.period_unit }
    };
    if (deltaFromDue <= 0) return { ...base, status: 'within_window', remainingDays: Math.max(0, -deltaFromDue) };
    if (deltaFromDue <= DEADLINE_BOUNDARY_DAYS) return { ...base, status: 'boundary' };
    return { ...base, status: 'late' };
  }

  function resolveException(config, branch, answers) {
    for (const item of config.full_refund_exceptions || []) {
      const applies = item.applies_to_branch === 'both' ||
        (item.applies_to_branch === 'pre_start_only' && branch === 'pre_start') ||
        (item.applies_to_branch === 'post_start_only' && branch === 'post_start');
      if (applies && answers && answers[item.exception_code] === 'evet') return { matched: true, item };
    }
    return { matched: false, item: null };
  }

  function resolvePreStartReconciliation(config, refundDueTuitionKurus, returnedKurus, totalPaidKurus) {
    const toleranceKurus = moneyToKurus(config.reconciliation_config?.mismatch_tolerance_tl || 0) || 0;
    const overpayment = returnedKurus > totalPaidKurus;
    if (!Number.isInteger(refundDueTuitionKurus)) {
      return { kind: 'facts_only', amountReturnedKurus: returnedKurus, totalPaidKurus, overpayment, toleranceKurus };
    }
    const reconciliationShortfallKurus = Math.max(0, refundDueTuitionKurus - returnedKurus);
    return {
      kind: reconciliationShortfallKurus > toleranceKurus ? 'shortfall' : 'reconciled',
      amountReturnedKurus: returnedKurus,
      totalPaidKurus,
      refundDueTuitionKurus,
      reconciliationShortfallKurus,
      overpayment,
      toleranceKurus
    };
  }

  function resolvePostStartReconciliation(config, classification, returnedKurus) {
    const toleranceKurus = moneyToKurus(config.reconciliation_config?.mismatch_tolerance_tl || 0) || 0;
    const overpayment = returnedKurus > classification.totalPaidKurus;
    if (classification.hasPendingRows) {
      return { kind: 'facts_only_pending', amountReturnedKurus: returnedKurus, totalPaidKurus: classification.totalPaidKurus, overpayment, toleranceKurus };
    }
    const unclampedDifferenceKurus = classification.tuitionBucketKurus + classification.ancillaryBucketKurus - returnedKurus;
    const differenceKurus = Math.max(0, unclampedDifferenceKurus);
    return {
      kind: differenceKurus > toleranceKurus ? 'difference' : 'facts_only',
      amountReturnedKurus: returnedKurus,
      totalPaidKurus: classification.totalPaidKurus,
      differenceKurus,
      overpayment,
      toleranceKurus
    };
  }

  function resolveEscalation(config, registry, reconciliation) {
    const thh = config.escalation_path?.thh_referral || {};
    const thresholdKurus = moneyToKurus(thh.esik_tutar_tl?.value);
    const thresholdKnown = Number.isInteger(thresholdKurus) && thresholdKurus > 0;
    const comparisonKurus = reconciliation && reconciliation.kind === 'shortfall' &&
      reconciliation.reconciliationShortfallKurus > reconciliation.toleranceKurus
      ? reconciliation.reconciliationShortfallKurus : undefined;
    let route = 'non_numeric';
    if (thresholdKnown && Number.isInteger(comparisonKurus)) route = comparisonKurus < thresholdKurus ? 'thh' : 'other_recourse';
    const asset11 = registry?.assets?.asset_11_thh || null;
    const asset11Live = Boolean(asset11?.live === true && asset11?.canonical_url);
    const canThhCta = asset11Live && route !== 'other_recourse';
    return {
      thresholdKnown,
      thresholdKurus: thresholdKnown ? thresholdKurus : undefined,
      comparisonKurus,
      route,
      appliesWhenTr: thh.applies_when_tr || '',
      canThhCta,
      crossLink: canThhCta ? { href: asset11.canonical_url } : null,
      preEscalationSteps: [...(config.escalation_path?.pre_escalation_steps || [])].sort((a,b) => (a.sequence_order || 0) - (b.sequence_order || 0)),
      otherRecourse: config.escalation_path?.other_recourse || []
    };
  }

  function buildOutOfScopeResult(config, registry, institution, input) {
    return {
      ok: true,
      variant: 'out_of_scope',
      institution,
      branch: null,
      feeClassification: null,
      exception: { matched: false, item: null },
      tuitionOutcome: null,
      deadline: { status: 'not_applicable' },
      reconciliation: null,
      evidenceChecklist: config.evidence_checklist || [],
      weakEvidenceNotice: input.written_notice_method === 'sozlu_yalnizca',
      escalation: resolveEscalation(config, registry, null),
      inputEcho: input
    };
  }

  function runAudit(config, input, context = {}) {
    const errors = [];
    const registry = context.registry || { assets: {} };
    const now = context.now instanceof Date ? context.now : new Date();
    const todayParts = context.todayParts || localTodayParts(now);

    if (config.post_start_guidance?.post_start_exact_refund_calculable !== false) {
      return { ok: false, errors: [{ field: 'post_start_guidance.post_start_exact_refund_calculable', code: 'config_must_be_false' }] };
    }
    if (config.pre_start_cancellation?.cooling_off_period?.applies === true) {
      return { ok: false, errors: [{ field: 'pre_start_cancellation.cooling_off_period.applies', code: 'schema_patch_required_contract_signature_date' }] };
    }

    // Step 1 — institution scope.
    const institution = (config.institution_types || []).find(x => x.type_code === input.institution_type_code);
    if (!institution) return { ok: false, errors: [{ field: 'institution_type_code', code: 'required' }] };
    if (institution.in_scope === false) return buildOutOfScopeResult(config, registry, institution, input);

    // Step 2 — fee-item classification firewall.
    const feeItems = Array.isArray(input.fee_items_paid) ? input.fee_items_paid : [];
    if (feeItems.length === 0) errors.push({ field: 'fee_items_paid', code: 'at_least_one_required' });
    const feeClassification = classifyFeeItems(config, feeItems);
    if (feeClassification.hasInvalidRows) errors.push({ field: 'fee_items_paid', code: 'invalid_amount' });

    // Step 3 — elapsed time from ayrılış tarihi.
    const departureParts = parseIsoParts(input.cancellation_notice_date);
    if (!departureParts) errors.push({ field: 'cancellation_notice_date', code: 'required' });
    else if (compareParts(departureParts, todayParts) > 0) errors.push({ field: 'cancellation_notice_date', code: 'future_date' });
    const returnedRaw = input.amount_returned_by_school_tl;
    const returnedKurus = returnedRaw === '' || returnedRaw === undefined || returnedRaw === null ? 0 : moneyToKurus(returnedRaw);
    if (!Number.isInteger(returnedKurus)) errors.push({ field: 'amount_returned_by_school_tl', code: 'must_be_gte_zero' });
    if (errors.length) return { ok: false, errors, institution, feeClassification };

    const daysSinceDeparture = daysFromCivil(todayParts) - daysFromCivil(departureParts);

    // Step 4 — pre-start / post-start branch.
    const academicYearStartIso = config.key_dates?.academic_year_start_date?.value;
    const academicYearStartParts = parseIsoParts(academicYearStartIso);
    if (!academicYearStartParts) {
      const deadline = resolveDeadline(config, null, departureParts, todayParts);
      return {
        ok: true,
        variant: 'branch_unknown',
        institution,
        feeClassification,
        branch: null,
        daysSinceDeparture,
        departureDateParts: departureParts,
        academicYearStartIso,
        academicYearStartParts: null,
        branchDataUnavailable: true,
        exception: { matched: false, item: null },
        tuitionOutcome: { kind: 'no_data' },
        deadline,
        reconciliation: null,
        evidenceChecklist: config.evidence_checklist || [],
        weakEvidenceNotice: input.written_notice_method === 'sozlu_yalnizca',
        escalation: resolveEscalation(config, registry, null),
        inputEcho: { ...input, amountReturnedKurus: returnedKurus }
      };
    }
    const branch = compareParts(departureParts, academicYearStartParts) < 0 ? 'pre_start' : 'post_start';

    // Step 5 — full-refund exception.
    const exception = resolveException(config, branch, input.full_refund_exception_answers || {});

    // Step 6 — verdict.
    let variant;
    let tuitionOutcome;
    if (exception.matched) {
      variant = 'full_refund_exception';
      tuitionOutcome = feeClassification.hasPendingRows
        ? { kind: 'figures_withheld_pending' }
        : { kind: 'full_refund_exception', refundDueTuitionKurus: feeClassification.tuitionBucketKurus, matchedExceptionCode: exception.item.exception_code };
    } else if (branch === 'pre_start') {
      variant = 'pre_start';
      tuitionOutcome = resolvePreStartStep6b(config, input, feeClassification.tuitionBucketKurus, feeClassification.hasPendingRows);
    } else {
      variant = 'post_start';
      tuitionOutcome = {
        kind: 'post_start_guidance_only',
        considerations: config.post_start_guidance?.considerations || [],
        recommendedNextSteps: [...(config.post_start_guidance?.recommended_next_steps || [])].sort((a,b) => (a.sequence_order || 0) - (b.sequence_order || 0))
      };
    }

    // Step 7 — statutory deadline.
    const deadline = resolveDeadline(config, branch, departureParts, todayParts);

    // Step 8 — reconciliation.
    let reconciliation;
    if (branch === 'post_start' && !exception.matched) {
      reconciliation = resolvePostStartReconciliation(config, feeClassification, returnedKurus);
    } else {
      reconciliation = resolvePreStartReconciliation(config, tuitionOutcome.refundDueTuitionKurus, returnedKurus, feeClassification.totalPaidKurus);
    }

    // Step 9 — evidence checklist.
    const evidenceChecklist = config.evidence_checklist || [];
    const weakEvidenceNotice = input.written_notice_method === 'sozlu_yalnizca';

    // Step 10 — escalation. Only a defined pre-start/exception shortfall can be numeric.
    const escalation = resolveEscalation(config, registry, reconciliation);

    // Step 11 — artifact adapters consume this result; no separate arithmetic there.
    return {
      ok: true,
      variant,
      institution,
      feeClassification,
      branch,
      daysSinceDeparture,
      departureDateParts: departureParts,
      academicYearStartIso,
      academicYearStartParts,
      exception,
      tuitionOutcome,
      deadline,
      reconciliation,
      evidenceChecklist,
      weakEvidenceNotice,
      escalation,
      inputEcho: { ...input, amountReturnedKurus: returnedKurus }
    };
  }

  const api = Object.freeze({
    UNCERTAIN_CATEGORY_CODE,
    DEADLINE_BOUNDARY_DAYS,
    moneyToKurus,
    parseIsoParts,
    isoFromParts,
    daysInMonth,
    daysFromCivil,
    civilFromDays,
    addCalendarMonths,
    addCalendarDays,
    localTodayParts,
    computeAcademicYearEffectiveUntil,
    classifyFeeItems,
    resolvePreStartStep6b,
    resolveDeadline,
    resolvePostStartReconciliation,
    runAudit
  });

  global.Asset22Engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
