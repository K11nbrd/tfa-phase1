(function (global) {
  'use strict';

  var MONTHS_TR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  function parseIsoDateOnly(value) {
    if (typeof value !== 'string') return null;

    var match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
    if (!match) return null;

    var year = Number(match[1]);
    var monthIndex = Number(match[2]) - 1;
    var day = Number(match[3]);

    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
      return null;
    }
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;

    // Construct from local calendar components only. Never parse the ISO string with Date.
    var date = new Date(year, monthIndex, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function toLocalDateOnly(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function formatTurkishDate(date) {
    return date.getDate() + ' ' + MONTHS_TR[date.getMonth()] + ' ' + date.getFullYear();
  }

  function checkEffectivity(options) {
    try {
      options = options || {};

      var effectiveFromDate = parseIsoDateOnly(options.effectiveFrom);
      var effectiveUntilDate = parseIsoDateOnly(options.effectiveUntil);
      var referenceDateOnly = toLocalDateOnly(
        options.referenceDate === undefined ? new Date() : options.referenceDate
      );

      // Fail open on missing/unparseable required dates or an invalid reference Date.
      if (!effectiveFromDate || !effectiveUntilDate || !referenceDateOnly) {
        return { stale: false, warningTr: null };
      }

      // Valid through effectiveUntil; stale starts strictly the day after.
      var stale = referenceDateOnly > effectiveUntilDate;
      if (!stale) return { stale: false, warningTr: null };

      var warningTr = null;
      if (typeof options.warningTemplate === 'string') {
        warningTr = options.warningTemplate.replace(
          '{{tarih}}',
          formatTurkishDate(effectiveFromDate)
        );
      }

      return { stale: true, warningTr: warningTr };
    } catch (error) {
      // Shared infrastructure must never break the calling calculator/page.
      return { stale: false, warningTr: null };
    }
  }

  global.TFAEffectivityGuard = {
    checkEffectivity: checkEffectivity
  };
})(window);
