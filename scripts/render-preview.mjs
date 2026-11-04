/**
 * 离屏渲染预览：用 @napi-rs/canvas 跑真实的 renderFrame，输出 PNG 用来肉眼验收。
 *   npm install @napi-rs/canvas --no-save
 *   node --experimental-strip-types scripts/render-preview.mjs
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

globalThis.document = {
  createElement: () => createCanvas(1, 1),
};

const { computeLayout, renderFrame } = await import('../src/render.ts');
const { DEFAULT_SETTINGS, PRESETS, STYLES } = await import('../src/types.ts');

GlobalFonts.registerFromPath?.('/System/Library/Fonts/Helvetica.ttc', 'Helvetica');

function makePhoto(w, h) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d2b53');
  g.addColorStop(0.35, '#5b4a7a');
  g.addColorStop(0.6, '#c9714f');
  g.addColorStop(0.78, '#f0a45c');
  g.addColorStop(1, '#2a2f3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sun = ctx.createRadialGradient(w * 0.52, h * 0.66, 0, w * 0.52, h * 0.66, 260);
  sun.addColorStop(0, 'rgba(255,236,190,0.95)');
  sun.addColorStop(1, 'rgba(255,170,110,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#171a22';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.78);
  ctx.lineTo(w * 0.22, h * 0.7);
  ctx.lineTo(w * 0.45, h * 0.79);
  ctx.lineTo(w * 0.68, h * 0.69);
  ctx.lineTo(w, h * 0.77);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  return c;
}

function makeLogo() {
  const c = createCanvas(360, 120);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(52, 60, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1d21';
  ctx.beginPath();
  ctx.arc(52, 60, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 46px Helvetica';
  ctx.textBaseline = 'middle';
  ctx.fillText('STUDIO 27', 100, 62);
  return c;
}

const photo = makePhoto(1600, 1200);
const logo = makeLogo();
const LONG = 1000;
const outDir = '.qa';
mkdirSync(outDir, { recursive: true });

const cases = STYLES.map((s) => ({
  style: s.id,
  settings: { ...DEFAULT_SETTINGS, ...PRESETS[s.id], style: s.id },
}));

// 额外几组：白边 + 水印居中、拍立得带题注
cases.push({
  style: 'matte-center',
  settings: {
    ...DEFAULT_SETTINGS,
    ...PRESETS.matte,
    style: 'matte',
    logoPos: 'mc',
    logoScale: 26,
    logoOpacity: 0.55,
    paper: '#1b1d21',
  },
});
cases.push({
  style: 'polaroid-caption',
  settings: {
    ...DEFAULT_SETTINGS,
    ...PRESETS.polaroid,
    style: 'polaroid',
    caption: 'Dusk over the ridge',
    exifLine: 'TESTCAM X100 MARK II · XF 23mm F1.4 R · 35mm · f/1.8 · 1/250s · ISO 400',
  },
});

for (const { style, settings } of cases) {
  const s = { ...settings, exifLine: settings.exifLine || '35mm · f/1.8 · 1/250s · ISO 400' };
  const L = computeLayout(
    { width: photo.width, height: photo.height, el: photo, name: 'qa' },
    s
  );
  const S = LONG / Math.max(L.frameW, L.frameH);
  const c = createCanvas(Math.round(L.frameW * S), Math.round(L.frameH * S));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  renderFrame(ctx, photo, L, s, S, logo);
  const file = `${outDir}/${style}.png`;
  writeFileSync(file, c.toBuffer('image/png'));
  console.log(`${file}  ${c.width}×${c.height}`);
}
