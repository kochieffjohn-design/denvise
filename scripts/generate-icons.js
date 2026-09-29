#!/usr/bin/env node
/**
 * Нарезает иконки PWA и сплэш-экраны iPhone из логотипа.
 *
 *   npm run icons
 *
 * Источник: assets/brand/logo-1080.png (квадрат, знак на фоне BG).
 * Рисует через canvas в браузере, который уже есть в системе (Edge/Chrome),
 * поэтому не нужны нативные библиотеки для работы с картинками.
 *
 * Пишет:
 *   public/icons/icon-{192,512}.png      — обычная иконка (manifest, purpose "any")
 *   public/icons/maskable-{192,512}.png  — для Android: знак уменьшен до безопасной
 *                                          зоны, чтобы круглая/квадратная маска его не срезала
 *   public/apple-touch-icon.png          — иконка экрана «Домой» на iPhone (180×180)
 *   public/favicon.png                   — вкладка браузера (32×32)
 *   public/splash/iphone-*.png           — сплэш при запуске установленного PWA на iPhone
 *   public/index.html                    — блок <link rel="apple-touch-startup-image">
 *                                          между маркерами splash:start / splash:end
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets/brand/logo-1080.png');
const PUBLIC = path.join(ROOT, 'public');

// Цвета логотипа (фон, зуб) — фон сплэша и manifest.background_color совпадают с ним
const BG = '#0f2a4a';
const ACCENT = '#5b9bff';
// Знак «D» занимает ~57% ширины исходника, а его углы — до 42.8% от центра.
// Безопасная зона маскируемой иконки — круг радиусом 40%, берём с запасом.
const MASKABLE_SCALE = 0.86;

// iOS не берёт сплэш из манифеста: нужна картинка ровно под размер экрана.
// [ширина в pt, высота в pt, плотность] — портретная ориентация.
const IPHONES = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6/7/8 Plus
  [375, 667, 2], // SE 2/3, 6/7/8
];

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const src = 'data:image/png;base64,' + fs.readFileSync(SOURCE).toString('base64');

  const render = (job) => page.evaluate(async ({ src, job }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = job.w;
    c.height = job.h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.fillStyle = job.bg;
    g.fillRect(0, 0, job.w, job.h);
    // Логотип квадратный: рисуем его квадратом size×size по центру (cx, cy)
    const size = job.logoSize;
    g.drawImage(img, job.cx - size / 2, job.cy - size / 2, size, size);
    if (job.wordmark) {
      const { y, fontSize } = job.wordmark;
      g.font = `800 ${fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      g.textBaseline = 'alphabetic';
      const a = 'Den', b = 'vise';
      const wa = g.measureText(a).width, wb = g.measureText(b).width;
      const x = (job.w - wa - wb) / 2;
      g.fillStyle = '#ffffff';
      g.fillText(a, x, y);
      g.fillStyle = job.accent;
      g.fillText(b, x + wa, y);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { src, job });

  const write = (rel, b64) => {
    const file = path.join(PUBLIC, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('  ' + rel);
  };
  const square = (size, scale = 1) => ({ w: size, h: size, bg: BG, cx: size / 2, cy: size / 2, logoSize: size * scale });

  console.log('Иконки:');
  for (const s of [192, 512]) {
    write(`icons/icon-${s}.png`, await render(square(s)));
    write(`icons/maskable-${s}.png`, await render(square(s, MASKABLE_SCALE)));
  }
  write('apple-touch-icon.png', await render(square(180)));
  write('favicon.png', await render(square(32)));

  console.log('Сплэш iPhone:');
  const links = [];
  for (const [wPt, hPt, dpr] of IPHONES) {
    const w = wPt * dpr, h = hPt * dpr;
    // Знак — 40% ширины экрана чуть выше центра, под ним надпись Denvise
    const logoSize = w * 0.40 / 0.57; // 0.57 — доля знака в исходнике
    const cy = h * 0.44;
    const markHalfHeight = logoSize * 0.64 / 2; // знак занимает 64% высоты исходника
    const fontSize = Math.round(w * 0.085);
    const rel = `splash/iphone-${w}x${h}.png`;
    write(rel, await render({ w, h, bg: BG, cx: w / 2, cy, logoSize, accent: ACCENT,
      // базовая линия: низ знака + отступ + высота заглавных (~0.72 кегля)
      wordmark: { y: cy + markHalfHeight + w * 0.08 + fontSize * 0.72, fontSize } }));
    links.push(`    <link rel="apple-touch-startup-image" href="/${rel}" media="(device-width: ${wPt}px) and (device-height: ${hPt}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`);
  }
  await browser.close();

  const indexFile = path.join(PUBLIC, 'index.html');
  const html = fs.readFileSync(indexFile, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const re = /(<!-- splash:start[^\n]*-->)[\s\S]*?(\s*<!-- splash:end -->)/;
  if (!re.test(html)) throw new Error('В public/index.html нет маркеров <!-- splash:start --> / <!-- splash:end -->');
  fs.writeFileSync(indexFile, html.replace(re, (_, start, end) => start + eol + links.join(eol) + end));
  console.log('public/index.html: обновлён блок сплэшей (' + links.length + ')');
}

async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // пробуем следующий браузер
    }
  }
  throw new Error('Не найден Edge или Chrome — установите один из них.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
