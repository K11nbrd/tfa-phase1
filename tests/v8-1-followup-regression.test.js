const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (entry.isFile()) files.push(p);
  }
  return files;
}

const allFiles = walk(repoRoot);
const textFiles = allFiles.filter((p) => {
  const ext = path.extname(p);
  return ['.html', '.js', '.xml', '.txt', '.md'].includes(ext) || path.basename(p) === 'robots.txt';
});
const allText = textFiles.map((p) => fs.readFileSync(p, 'utf8')).join('\n');

assert(read('shared/js/analytics.js').includes("var MEASUREMENT_ID = 'G-4XP4GMLKKS'"), 'GA4 Measurement ID must be the confirmed production ID.');
assert(!allText.includes('G-' + 'X'.repeat(10)), 'GA4 placeholder must not remain anywhere in text source.');

const htmlFiles = allFiles.filter((p) => p.endsWith('.html'));
assert(htmlFiles.length > 0, 'HTML pages must exist.');
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(repoRoot, file);
  assert(!html.includes('test ' + 'dizesi'), `${rel} must not include leaked footer test string.`);
  assert(!html.includes('Şşğ Ğı' + 'İöö Üüçç'), `${rel} footer must not include Turkish-character test string.`);
  assert(html.includes('<footer class="footer"><div class="wrap">Bilgilendirme amaçlıdır.</div></footer>'), `${rel} footer must be production copy only.`);
}

assert(!allText.includes('tfa-phase1.' + 'vercel.' + 'app'), 'Old staging domain must not remain.');
assert(!allText.includes('vercel.' + 'app'), 'No hardcoded staging host URLs should remain.');
const sitemap = read('sitemap.xml');
assert(sitemap.includes('https://dogrusonuc.com/'), 'Sitemap must use production domain.');
assert(!sitemap.includes('https://tfa-phase1.' + 'vercel.' + 'app/'), 'Sitemap must not use staging domain.');
assert(read('robots.txt').includes('Sitemap: https://dogrusonuc.com/sitemap.xml'), 'robots.txt must point to production sitemap.');

console.log('PASS v8.1 follow-up regression: GA4 ID, footer copy, and production-domain URLs verified.');
