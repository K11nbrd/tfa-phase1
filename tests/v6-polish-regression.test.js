#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const asset7Js = read('assets/asset7/asset7.js');
const asset7Html = read('assets/asset7/kidem-tazminati-hesaplama.html');
const pdfAdapter = read('shared/js/asset7-pdf-adapter.js');
const asset10Js = read('assets/asset10/asset10.js');
const asset7Json = read('data/asset7.json');
const asset10Json = read('data/asset10.json');
const asset7Data = JSON.parse(asset7Json);
const asset10Data = JSON.parse(asset10Json);

// Fix 1 — PDF service duration is humanized from days; decimal-year display is no longer the PDF input summary.
assert(asset7Js.includes('function humanizeServiceDuration(totalDays)'), 'Asset 7 must provide a display-only humanized service duration helper.');
assert(asset7Js.includes('tenure_label_tr:tenureLabel'), 'Asset 7 must pass a humanized tenure label into the PDF payload.');
assert(pdfAdapter.includes('function humanizeServiceDuration(totalDays)'), 'PDF adapter must independently humanize service duration for fallback payloads.');
assert(!pdfAdapter.includes('`${formatInteger(derived.serviceDays)} gün (${formatDecimal(derived.serviceYears, 4)} yıl)`'), 'PDF must not show raw decimal-year service duration.');

// Fix 2 — tavan history renders newest first without mutating asset7.json.
assert(asset7Js.includes('const history=[...(config.tavan_history||[])].reverse()'), 'Tavan history render order must be reversed at template level.');
assert.strictEqual(asset7Data.tavan_history[0].period_label, '2021 I. Yarı', 'asset7.json must remain schema/data unchanged and oldest-first in source data.');
assert.strictEqual(asset7Data.tavan_history.at(-1).period_label, '2026 I. Yarı', 'asset7.json current tavan row must remain at end of source data.');

// Fix 3 — month rendering uses calendar order instead of Object.entries insertion order.
assert(asset10Js.includes("const MONTH_ORDER=['01','02','03','04','05','06','07','08','09','10','11','12'];"), 'Asset 10 must define canonical calendar month order.');
assert(asset10Js.includes('orderedMonthEntries(p.monthly_limits_sm3)'), 'Asset 10 limits grid must use ordered month entries.');
assert(!asset10Js.includes('Object.entries(p.monthly_limits_sm3).map'), 'Asset 10 limits grid must not rely on object insertion order.');

// Fix 4 — calculator tavan note is hidden unless a calculation actually occurs.
assert(asset7Html.includes('id="calcTavanNote" hidden'), 'Asset 7 calculator tavan note must be hidden by default.');
assert(asset7Js.includes('setCalcTavanVisible(false);out.className=\'verdict bad\''), 'Asset 7 must hide tavan note on ineligible verdicts.');
assert(asset7Js.includes('setCalcTavanVisible(true);'), 'Asset 7 must show tavan note only after an eligible calculation.');

// Fix 5 — only dropdown copy softens death wording; source data and statutory contexts stay unchanged.
assert(asset7Js.includes("rule?.id==='olum'?'İşçinin vefatı'"), 'Dropdown label must render İşçinin vefatı for the death reason.');
assert(asset7Json.includes('"label_tr": "İşçinin ölümü"'), 'asset7.json must keep statutory/source wording unchanged.');

// Fix 6 — numeric inputs clear default 0 on focus and restore on blur.
assert(asset7Html.includes('name="base" type="text" inputmode="decimal" value="0" autocomplete="off" data-number-input required'), 'Base salary numeric field must default to 0 and accept locale-formatted text input.');
assert(asset7Js.includes("input.addEventListener('focus',()=>{if(input.value==='0') input.value='';});"), 'Numeric inputs must clear 0 on focus.');
assert(asset7Js.includes("input.addEventListener('blur',()=>{if(input.value==='') input.value='0';});"), 'Numeric inputs must restore 0 on empty blur.');

// Fix 7 — gender is hidden by default and required only for marriage.
assert(asset7Html.includes('id="genderField" hidden'), 'Gender field must be hidden by default.');
assert(asset7Html.includes('<option value="">Seçiniz</option><option value="female">Kadın</option>'), 'Gender field must have no preselected user value.');
assert(asset7Js.includes("const needsGender=reason.value==='evlilik';"), 'Gender field visibility must depend on evlilik reason.');
assert(asset7Js.includes('gender.required=needsGender;'), 'Gender field must be required only when evlilik is selected.');
assert(asset7Js.includes("if(!needsGender) gender.value='';"), 'Gender value must be cleared for non-marriage reasons.');

// Fix 8 — province dropdown surfaces Big 3 with optgroup separator and keeps all 81 below.
assert(asset10Js.includes('Sık seçilen iller'), 'Province selector must include popular-cities optgroup.');
assert(asset10Js.includes('Tüm iller (A-Z)'), 'Province selector must include full-list optgroup.');
assert(asset10Js.includes("const popular=['istanbul','ankara','izmir']"), 'Popular city order must be İstanbul, Ankara, İzmir.');
assert.strictEqual(asset10Data.provinces.length, 81, 'asset10.json must remain full 81-province data.');

// Fix 9 — no raw KADEME enum leaks in user-facing result/card headline.
assert(asset10Js.includes("function tariffText(v){return v.verdict==='KADEME_2'?'Yüksek tarife uygulanır':'Standart tarife uygulanır'}"), 'Asset 10 must map raw enum to Turkish tariff text.');
assert(!asset10Js.includes('<div class="big">${v.verdict}</div>'), 'On-page verdict must not display raw enum.');
assert(!asset10Js.includes('ctx.fillText(v.verdict'), 'PNG verdict card must not draw raw enum.');
assert(asset10Js.includes('fitText(ctx,tariffText(v)'), 'PNG verdict card headline must use the user-facing tariff text.');

console.log('PASS v6 polish regression: 9 requested UX/display fixes preserved, with numeric input mode superseded by v8 comma/period parsing.');
