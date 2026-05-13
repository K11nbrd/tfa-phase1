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
const asset7Html = read('assets/asset7/kidem-tazminati-hesaplama.html');

assert(asset7Js.includes('function autoFormatTurkishDateInput(value)'), 'Asset 7 must include Turkish date auto-formatting helper.');
assert(asset7Js.includes('syncDateInputMask(input)'), 'Asset 7 date inputs must be masked as the user types.');
assert(asset7Html.includes('inputmode="numeric" placeholder="gg/aa/yyyy" maxlength="10"'), 'Asset 7 date inputs must keep mobile numeric keyboard and 10-char Turkish format.');

const executable = asset7Js
  .replace(/^import .*$/gm, '')
  .replace(/async function init\(\)[\s\S]*$/m, '') + `\n__RESULT__ = {\n  raw8: autoFormatTurkishDateInput('08052021'),\n  partial2: autoFormatTurkishDateInput('08'),\n  partial4: autoFormatTurkishDateInput('0805'),\n  pastedDots: autoFormatTurkishDateInput('08.05.2021'),\n  iso: autoFormatTurkishDateInput('2021-05-08'),\n  parsed: parseTurkishDate('08/05/2021'),
  parsedRaw: parseTurkishDate('08052021'),
  invalidRaw: parseTurkishDate('31022021')\n};`;
const sandbox = { __RESULT__: null, console };
vm.createContext(sandbox);
vm.runInContext(executable, sandbox);
assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.__RESULT__)), {
  raw8: '08/05/2021',
  partial2: '08',
  partial4: '08/05',
  pastedDots: '08/05/2021',
  iso: '2021-05-08',
  parsed: '2021-05-08',
  parsedRaw: '2021-05-08',
  invalidRaw: ''
}, 'Turkish date mask must turn 08052021 into 08/05/2021 and validation must parse both raw and formatted input.');

assert(read('shared/js/asset7-pdf-adapter.js').includes('/assets/fonts/'), 'PDF adapter must continue to resolve Roboto font paths.');
assert(exists('assets/fonts/README-ROBOTO.txt'), 'Roboto deployment note must remain in assets/fonts.');

console.log('PASS v8.2 regression: mobile Turkish date auto-slash and Roboto font path wiring verified.');
