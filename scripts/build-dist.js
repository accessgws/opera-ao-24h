const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
for (const rootFile of ['manifest.webmanifest', 'sw.js']) {
  const src = path.join(ROOT, rootFile);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, rootFile));
}
for (const dir of ['assets', 'css', 'js']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}

console.log('Build Cloudflare concluído em dist/ (index.html, assets, css, js).');
