#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const asset7Js = read('assets/asset7/asset7.js');
const asset7Html = read('assets/asset7/kidem-tazminati-hesaplama.html');
const asset10Js = read('assets/asset10/asset10.js');
const asset10Data = json('data/asset10.json');
const asset7Config = json('data/asset7.json');

// Asset 7 leap-day / anniversary logic.
assert(asset7Js.includes('function computeTenure(startValue,endValue)'), 'Asset 7 must compute anniversary-aware tenure.');
assert(asset7Js.includes('start.day===end.day&&start.month===end.month'), 'Anniversary match must be based on same day and month.');

const asset7Executable = asset7Js
  .replace(/^import .*$/gm, '')
  .replace(/init\(\)\.catch[\s\S]*$/m, '') + `\n
config = __CONFIG__;
__RESULT__ = {
  anniversary: calc({reason:'isveren_feshi', gender:'male', start:'2021-05-08', end:'2026-05-08', base:50000, food:3000, transport:2000, fuelAnnual:6000}),
  oneDayAfter: calc({reason:'isveren_feshi', gender:'male', start:'2021-05-08', end:'2026-05-09', base:50000, food:3000, transport:2000, fuelAnnual:6000}),
  maleMarriage: calc({reason:'evlilik', gender:'male', start:'2021-05-08', end:'2026-05-08', base:50000, food:3000, transport:2000, fuelAnnual:6000}),
  femaleMarriage: calc({reason:'evlilik', gender:'female', start:'2021-05-08', end:'2026-05-08', base:50000, food:3000, transport:2000, fuelAnnual:6000}),
  tenureLabel: humanizeServiceDuration(1826, computeTenure('2021-05-08','2026-05-08'))
};`;
const asset7Sandbox = { __CONFIG__: asset7Config, __RESULT__: null, console };
vm.createContext(asset7Sandbox);
vm.runInContext(asset7Executable, asset7Sandbox, { filename: 'asset7.js' });

assert.strictEqual(asset7Sandbox.__RESULT__.anniversary.serviceMultiplier, 5, 'Same calendar date 5 years apart must be exactly 5 years.');
assert.strictEqual(asset7Sandbox.__RESULT__.anniversary.gross, 277500, 'Anniversary case gross must be 277,500.00 TL.');
assert.strictEqual(round2(asset7Sandbox.__RESULT__.anniversary.net), 275393.78, 'Anniversary case net must be 275,393.78 TL.');
assert(asset7Sandbox.__RESULT__.oneDayAfter.serviceMultiplier > 5, 'One day after anniversary must use exact day-count prorating.');
assert.strictEqual(asset7Sandbox.__RESULT__.tenureLabel, '5 yıl', 'Anniversary display must show whole years without leap-day remainder.');
assert.strictEqual(asset7Sandbox.__RESULT__.maleMarriage.eligible, false, 'Male + evlilik must be ineligible.');
assert(asset7Sandbox.__RESULT__.maleMarriage.gate.reason.includes('yalnızca kadın işçi'), 'Male + evlilik verdict must explain the rule.');
assert.strictEqual(asset7Sandbox.__RESULT__.femaleMarriage.eligible, true, 'Female + evlilik path remains eligible after minimum tenure.');

// Asset 7 UX display changes.
assert(!asset7Html.includes('Belirtmek istemiyorum'), 'Gender selector must not include “Cinsiyet belirtmek istemiyorum”.');
assert(asset7Html.includes('placeholder="gg/aa/yyyy"'), 'Date inputs must show Turkish date placeholder.');
assert(asset7Html.includes('type="text" inputmode="numeric"'), 'Date fields must be text inputs to avoid browser mm/dd/yyyy locale rendering.');
assert(asset7Html.includes('Evlilik nedeniyle kıdem tazminatı yalnızca nikah tarihinden itibaren 1 yıl içinde'), 'Evlilik 1-year disclosure must be present.');
assert(asset7Js.includes('parseTurkishDate'), 'Asset 7 must parse Turkish dd/mm/yyyy date input.');

const tavanPage = read('assets/asset7/kidem-tazminati-tavani-tarihi.html');
assert(!tavanPage.includes('Güncel ve geçmiş dönem tavanları JSON'), 'Developer placeholder must be removed from tavan history page.');
assert(tavanPage.includes("Aşağıda 2022'den günümüze"), 'Tavan history must have user-facing intro copy.');
assert(asset7Js.includes('normalizePeriodLabel'), 'Tavan history must normalize Roman period numerals at render time.');
assert(asset7Js.includes("replace(/\\bI\\. Yarı\\b/g,'1. Yarı')"), 'Tavan history must render I. Yarı as 1. Yarı.');
assert(asset7Js.includes("replace(/\\bII\\. Yarı\\b/g,'2. Yarı')"), 'Tavan history must render II. Yarı as 2. Yarı.');

// Placeholder pages.
[
  'assets/asset7/giydirilmis-ucret-nedir.html',
  'assets/asset7/ihbar-tazminati-hesaplama.html',
  'assets/asset7/yillik-izin-ucretim.html',
  'assets/asset7/arabuluculuk-rehberi.html',
  'assets/asset7/evlilik-tazminati.html',
  'assets/asset10/kfu-nedir-nasil-calisir.html',
  'assets/asset10/dogalgaz-fatura-nasil-okunur.html',
  'assets/asset10/dogalgaz-tasarruf-ipuclari.html',
  'assets/asset10/kademe-2-nasil-dusurulurum.html'
].forEach((rel) => {
  const html = read(rel);
  assert(html.includes('Yapım aşamasında'), `${rel} must show construction panel.`);
  assert(html.includes('Ana hesaplayıcıya dön →'), `${rel} must include calculator CTA.`);
});

// Asset 10 warning copy and tax-inclusive card display.
assert.strictEqual(asset10Data.pricing.kdv_rate, 0.20, 'Asset 10 data must include KDV rate.');
assert.strictEqual(asset10Data.pricing.kdv_effective_from, '2023-07-10', 'Asset 10 data must include KDV effective date.');
assert.strictEqual(asset10Data.pricing.otv_per_sm3, 0.1468, 'Asset 10 data must include ÖTV per sm3.');
assert.strictEqual(asset10Data.pricing.otv_effective_from, '2025-12-31', 'Asset 10 data must include confirmed ÖTV effective date.');
assert(asset10Data.pricing.tax_source_citation, 'Asset 10 data must include tax source citation field.');
assert(asset10Data.verdict_card_config.full_bill_flip_warning_tr.includes('Aylık kademe sınırından'), 'Full-bill-flip warning must clarify “than what”.');
assert(asset10Data.verdict_card_config.kdv_otv_disclaimer_tr.includes('KDV ve ÖTV dahil tahmini fatura'), 'Disclaimer must acknowledge tax-inclusive estimate.');
assert(asset10Js.includes('taxInclusiveAmount'), 'Asset 10 must compute tax-inclusive estimate.');
assert(asset10Js.includes('KDV ve ÖTV dahil tahmini fatura'), 'Asset 10 on-page and PNG output must mention tax-inclusive estimate.');

const asset10Executable = asset10Js
  .replace(/^import .*$/gm, '')
  .replace(/async function ensureRobotoCanvasFonts[\s\S]*?\n}\nconst dataPath/m, 'const dataPath')
  .replace(/init\(\)\.catch[\s\S]*$/m, '') + `\n
config = __CONFIG__;
__RESULT__ = calculate('istanbul','04',193.55);`;
const asset10Sandbox = { __CONFIG__: asset10Data, __RESULT__: null, console };
vm.createContext(asset10Sandbox);
vm.runInContext(asset10Executable, asset10Sandbox, { filename: 'asset10.js' });
const expectedTaxInclusive = 193.55 * ((18 + 0.1468) * 1.20);
assert.strictEqual(round2(asset10Sandbox.__RESULT__.taxInclusiveBill), round2(expectedTaxInclusive), 'Tax-inclusive formula must be consumption × ((rate + ÖTV) × (1 + KDV)).');

// Root index.
const rootIndex = read('index.html');
assert(rootIndex.includes('Kıdem Tazminatı Hesaplayıcı'), 'Root index must link Asset 7 calculator.');
assert(rootIndex.includes('Doğalgaz Kademe Hesaplayıcı'), 'Root index must link Asset 10 calculator.');

console.log('PASS v7 batch regression: 12 requested items verified, including confirmed ÖTV effective date 2025-12-31.');
