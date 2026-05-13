#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(repoRoot, rel));

const asset7Js = read('assets/asset7/asset7.js');
const asset10Js = read('assets/asset10/asset10.js');
const pdfAdapter = read('shared/js/asset7-pdf-adapter.js');
const configLoader = read('shared/js/config-loader.js');
const analytics = read('shared/js/analytics.js');
const asset7CalcHtml = read('assets/asset7/kidem-tazminati-hesaplama.html');
const asset10CalcHtml = read('assets/asset10/dogalgaz-kademe-hesaplama.html');
const asset7Data = JSON.parse(read('data/asset7.json'));

// Fix 1 — PDF developer test string removed.
assert(!pdfAdapter.includes('Türkçe karakter testi'), 'PDF adapter must not include developer Turkish character test string.');
assert(pdfAdapter.includes("data?.pdf_config?.title_tr || 'Kıdem Tazminatı Hesap Tutanağı'"), 'PDF header must still render the document title.');

// Fix 2 — tavan history displays Arabic numerals without mutating source order/data labels.
assert(asset7Js.includes('normalizePeriodLabel'), 'Asset 7 must normalize tavan period labels at render time.');
assert(asset7Js.includes("replace(/\\bI\\. Yarı\\b/g,'1. Yarı')"), 'I. Yarı must render as 1. Yarı.');
assert(asset7Js.includes("replace(/\\bII\\. Yarı\\b/g,'2. Yarı')"), 'II. Yarı must render as 2. Yarı.');
assert.strictEqual(asset7Data.tavan_history[0].period_label, '2021 I. Yarı', 'asset7.json source data remains canonical/oldest-first.');

// Fix 3 — comma and period numeric input support.
assert(asset7CalcHtml.includes('data-number-input'), 'Asset 7 wage inputs must use locale-normalized text fields.');
assert(asset7CalcHtml.includes('name="base" type="text" inputmode="decimal"'), 'Asset 7 base wage field must accept comma input.');
assert(asset10CalcHtml.includes('name="consumption" type="text" inputmode="decimal"'), 'Asset 10 consumption field must accept comma input.');
assert(asset7Js.includes('function normalizeNumericInput(value)'), 'Asset 7 must include numeric normalization.');
assert(asset10Js.includes('function normalizeNumericInput(value)'), 'Asset 10 must include numeric normalization.');

function evalNormalizer(source) {
  const executable = source.replace(/^import .*$/gm, '').replace(/init\(\)\.catch[\s\S]*$/m, '') + '\n__RESULT__ = [normalizeNumericInput("55.500,75"), normalizeNumericInput("55500.75"), normalizeNumericInput("1,234.56"), normalizeNumericInput("1.234")];';
  const sandbox = { __RESULT__: null, console };
  vm.createContext(sandbox);
  vm.runInContext(executable, sandbox);
  return JSON.parse(JSON.stringify(sandbox.__RESULT__));
}
assert.deepStrictEqual(evalNormalizer(asset7Js), ['55500.75', '55500.75', '1234.56', '1234'], 'Asset 7 numeric normalizer must handle Turkish and period-decimal input.');
assert.deepStrictEqual(evalNormalizer(asset10Js), ['55500.75', '55500.75', '1234.56', '1234'], 'Asset 10 numeric normalizer must handle Turkish and period-decimal input.');

// Fix 4 — GA4 placeholder and event hooks.
assert(analytics.includes("G-4XP4GMLKKS"), 'GA4 production Measurement ID must be centralized.');
assert(analytics.includes('googletagmanager.com/gtag/js'), 'GA4 loader must target gtag.js.');
assert(configLoader.includes("gtag('event', name, params)"), 'Shared trackEvent helper must call gtag events safely.');
assert(asset7Js.includes("trackEvent('calculate_kidem'"), 'Asset 7 calculation event must be wired.');
assert(asset7Js.includes("trackEvent('pdf_download'"), 'Asset 7 PDF event must be wired.');
assert(asset10Js.includes("trackEvent('calculate_kademe'"), 'Asset 10 calculation event must be wired.');
assert(asset10Js.includes("trackEvent('png_share'"), 'Asset 10 PNG share event must be wired.');
assert(configLoader.includes("trackEvent('cross_link_click'"), 'Cross-link click event must be wired.');

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(path.relative(repoRoot, p));
  }
}
walk(repoRoot);
for (const rel of htmlFiles) {
  assert(read(rel).includes('/shared/js/analytics.js'), `${rel} must include shared analytics loader in the page head.`);
}

// Fix 5 — sitemap and robots.
assert(exists('sitemap.xml'), 'sitemap.xml must exist at root.');
assert(exists('robots.txt'), 'robots.txt must exist at root.');
const sitemap = read('sitemap.xml');
assert(sitemap.includes('https://dogrusonuc.com/'), 'Sitemap must include root URL.');
assert(sitemap.includes('assets/asset7/kidem-tazminati-hesaplama.html'), 'Sitemap must include Asset 7 calculator.');
assert(sitemap.includes('assets/asset10/dogalgaz-kademe-hesaplama.html'), 'Sitemap must include Asset 10 calculator.');
assert.strictEqual((sitemap.match(/<url>/g) || []).length, htmlFiles.length, 'Sitemap URL count must match HTML page count.');
assert(read('robots.txt').includes('Sitemap: https://dogrusonuc.com/sitemap.xml'), 'robots.txt must point to sitemap.');

// Fix 6 — required binary path check for jsPDF and documented font path expectation.
assert(exists('vendor/jspdf.umd.min.js'), 'jsPDF binary must be present.');
assert(exists('assets/fonts/README-ROBOTO.txt'), 'Roboto font path documentation must remain present.');

console.log('PASS v8 batch regression: 6 requested polish/revenue/SEO items verified with v8.1 domain/GA updates.');
