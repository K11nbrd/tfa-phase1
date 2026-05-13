const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'asset10.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'assets', 'asset10', 'asset10.js'), 'utf8');

function fail(msg){ console.error(`FAIL ${msg}`); process.exit(1); }
function assert(condition, msg){ if(!condition) fail(msg); }

assert(source.includes("const POPULAR_PROVINCE_SLUGS=['istanbul','ankara','izmir'];"), 'popular slugs must be explicit and ordered');
assert(source.includes('value="${p.slug}"'), 'option value must bind to canonical province slug');
assert(!source.includes('value="${i}"') && !source.includes('value="${index}"'), 'province dropdown must not use index-backed option values');
assert(source.includes("localeCompare(b.name_tr,'tr')"), 'A-Z optgroup should use Turkish locale sorting');

const bySlug = new Map(data.provinces.map(p => [p.slug, p]));
function calculate(slug, month, consumption){
  const p = bySlug.get(slug);
  if(!p) throw new Error(`missing slug ${slug}`);
  const limit = Number(p.monthly_limits_sm3[month]);
  const rate = consumption > limit ? data.pricing.kademe_2_tl_per_sm3 : data.pricing.kademe_1_tl_per_sm3;
  return { province: p.name_tr, slug, month, consumption, limit, bill: consumption * rate };
}

const cases = [
  ['istanbul', '04', 200, 192.55],
  ['ankara', '01', 350, 344.73],
  ['izmir', '12', 250, 196.23],
];

for (const [slug, month, consumption, expectedLimit] of cases) {
  const popularValue = slug;
  const alphabeticalValue = slug;
  assert(popularValue === alphabeticalValue, `${slug} popular and A-Z options must submit identical value`);
  const fromPopular = calculate(popularValue, month, consumption);
  const fromAlphabetical = calculate(alphabeticalValue, month, consumption);
  assert(fromPopular.limit === expectedLimit, `${slug} top selection limit mismatch: expected ${expectedLimit}, got ${fromPopular.limit}`);
  assert(fromAlphabetical.limit === expectedLimit, `${slug} A-Z selection limit mismatch: expected ${expectedLimit}, got ${fromAlphabetical.limit}`);
  assert(JSON.stringify(fromPopular) === JSON.stringify(fromAlphabetical), `${slug} popular and A-Z calculations diverged`);
}

console.log('PASS v8.2 dropdown regression: popular and A-Z province selections share canonical slug-backed calculations.');
