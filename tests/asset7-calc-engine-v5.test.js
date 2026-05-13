#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const asset7Path = path.join(repoRoot, 'assets/asset7/asset7.js');
const configPath = path.join(repoRoot, 'data/asset7.json');
const source = fs.readFileSync(asset7Path, 'utf8');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

assert(
  source.includes('const fuelMonthly=input.fuelAnnual/MONTHS_PER_YEAR;'),
  'Asset 7 source must monthly-annualize yakacak as fuelAnnual / 12 via MONTHS_PER_YEAR.'
);
assert(
  source.includes('const monthlyDressed=input.base+input.food+input.transport+fuelMonthly;'),
  'Asset 7 monthly dressed wage must add base + yemek + yol + monthly yakacak without extra conversion.'
);
assert(
  source.indexOf('const cappedMonthly=Math.min(monthlyDressed, config.tavan.current_tl_per_year);') <
    source.indexOf('const gross=cappedMonthly*serviceMultiplier;'),
  'Tavan must be applied to monthly dressed wage before multiplying by service multiplier.'
);

const executable = source
  .replace(/^import .*$/gm, '')
  .replace(/init\(\)\.catch[\s\S]*$/m, '') + `\n
config = __CONFIG__;
__RESULT__ = {
  blocker: calc({
    reason: 'isveren_feshi',
    gender: 'male',
    start: '2021-05-11',
    end: '2026-05-10',
    base: 50000,
    food: 3000,
    transport: 2000,
    fuelAnnual: 6000
  }),
  ineligible: calc({
    reason: 'isveren_feshi',
    gender: 'male',
    start: '2026-01-01',
    end: '2026-12-31',
    base: 50000,
    food: 3000,
    transport: 2000,
    fuelAnnual: 6000
  }),
  resignation: calc({
    reason: 'istifa',
    gender: 'male',
    start: '2021-05-11',
    end: '2026-05-10',
    base: 50000,
    food: 3000,
    transport: 2000,
    fuelAnnual: 6000
  })
};`;

const sandbox = { __CONFIG__: config, __RESULT__: null, console };
vm.createContext(sandbox);
vm.runInContext(executable, sandbox, { filename: 'asset7.js' });

const { blocker, ineligible, resignation } = sandbox.__RESULT__;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

assert.strictEqual(blocker.eligible, true, 'Blocker fixture must be eligible.');
assert.strictEqual(blocker.serviceMultiplier, 5, 'Blocker fixture must use exactly 5 years.');
assert.strictEqual(blocker.fuelMonthly, 500, '6,000 TL annual yakacak must contribute 500 TL/month.');
assert.strictEqual(blocker.monthlyDressed, 55500, 'Giydirilmiş aylık must be 55,500 TL.');
assert.strictEqual(blocker.cappedMonthly, 55500, 'Below-tavan case must not be capped.');
assert.strictEqual(blocker.gross, 277500, 'Brüt kıdem must be 277,500.00 TL.');
assert.strictEqual(round2(blocker.stamp), 2106.23, 'Damga vergisi must round to 2,106.23 TL.');
assert.strictEqual(round2(blocker.net), 275393.78, 'Net kıdem must round to 275,393.78 TL.');

assert.strictEqual(ineligible.eligible, false, '364-day tenure fixture must be ineligible.');
assert.strictEqual(Object.prototype.hasOwnProperty.call(ineligible, 'gross'), false, 'Ineligible fixture must not compute gross.');
assert.strictEqual(Object.prototype.hasOwnProperty.call(ineligible, 'net'), false, 'Ineligible fixture must not compute net.');
assert.strictEqual(resignation.eligible, false, 'Plain resignation fixture must be ineligible.');
assert.strictEqual(Object.prototype.hasOwnProperty.call(resignation, 'monthlyDressed'), false, 'Resignation fixture must not compute monthly dressed wage.');

console.log('PASS asset7 v5 calc engine hotfix: yakacak annualization, tavan order, and eligibility gate verified.');
