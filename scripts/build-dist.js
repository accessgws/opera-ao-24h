const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
if (fs.existsSync(path.join(ROOT, 'manifest.webmanifest'))) {
  fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
}
if (fs.existsSync(path.join(ROOT, 'sw.js'))) {
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')
    .replace("const CACHE_NAME = 'op24h-pwa-v1';", `const CACHE_NAME = 'op24h-pwa-${Date.now()}';`);
  fs.writeFileSync(path.join(DIST, 'sw.js'), swSrc, 'utf8');
}
for (const dir of ['assets', 'css', 'js']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}

console.log('Build Cloudflare concluído em dist/ (index.html, assets, css, js).');
