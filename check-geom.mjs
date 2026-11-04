/**
 * 布局与渲染自检：不需要浏览器，直接跑 computeLayout / renderFrame。
 *
 *   npm run check
 *
 * 检查项：
 *   1. 照片矩形必须落在画布内（出血样式除外，它本来就该溢出后被裁切）
 *   2. 横图 / 竖图 / 方图 / 超宽图 × 六种画幅比例，都不能出现 NaN、负值、越界
 *   3. 用假的 canvas context 跑一遍 renderFrame，确认绘制参数都是有限数（水印位置最容易算错）
 */
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ filter: 'none' }) }),
};

const { computeLayout, framePixelSize, renderFrame } = await import('./src/render.ts');
const { PRESETS, DEFAULT_SETTINGS, STYLES, POS9 } = await import('./src/types.ts');

const styles = STYLES.map((s) => s.id);
const aspects = ['original', '1:1', '4:5', '3:2', '16:9', '5:7'];
const sizes = [
  [1600, 1200],
  [1200, 1600],
  [1600, 1600],
  [3000, 800],
];

let fails = 0;

const inside = (L) =>
  L.photo.x >= -0.01 &&
  L.photo.y >= -0.01 &&
  L.photo.x + L.photo.w <= L.frameW + 0.01 &&
  L.photo.y + L.photo.h <= L.frameH + 0.01;

const finite = (L) =>
  Number.isFinite(L.frameW) &&
  Number.isFinite(L.frameH) &&
  Number.isFinite(L.photo.w) &&
  Number.isFinite(L.photo.h) &&
  L.frameW > 0 &&
  L.frameH > 0 &&
  L.photo.w > 0 &&
  L.photo.h > 0;

for (const [w, h] of sizes) {
  const photo = { width: w, height: h, el: {}, name: 'check' };
  for (const style of styles) {
    for (const aspect of aspects) {
      const s = { ...DEFAULT_SETTINGS, ...PRESETS[style], style, aspect };
      const L = computeLayout(photo, s);
      const problems = [];
      if (!finite(L)) problems.push('非法尺寸');
      if (!inside(L) && style !== 'bleed') problems.push('照片越界');
      if (style === 'bleed' && s.borderPct === 0 && L.margin !== 0) problems.push('出血却留了边');
      if (problems.length) {
        fails += 1;
        console.log(`✗ ${w}x${h} ${style}/${aspect}: ${problems.join('、')}`, JSON.stringify(L));
      }
    }
  }
}

// 主用例明细
const photo = { width: 1600, height: 1200, el: {}, name: 'check' };
console.log('\n1600×1200 横图，导出长边 2048：');
for (const style of styles) {
  const s = { ...DEFAULT_SETTINGS, ...PRESETS[style], style };
  const L = computeLayout(photo, s);
  const px = framePixelSize(photo, s, 2048);
  console.log(
    `  ${style.padEnd(9)} 画布 ${L.frameW.toFixed(0)}×${L.frameH.toFixed(0)}` +
      ` · 照片 ${L.photo.w.toFixed(0)}×${L.photo.h.toFixed(0)}` +
      ` · 边距 ${L.margin.toFixed(0)} · 底边 ${L.band.toFixed(0)}` +
      ` · 输出 ${px.w}×${px.h}`
  );
}

// 合并后的等价性：卡纸 + 固定画幅 应当接管原来「白边留白」的职责
const insetLike = { ...DEFAULT_SETTINGS, ...PRESETS.matte, style: 'matte', aspect: '4:5' };
const IL = computeLayout(photo, insetLike);
console.log(
  `  matte+4:5 画布 ${IL.frameW.toFixed(0)}×${IL.frameH.toFixed(0)}` +
    ` · 照片 ${IL.photo.w.toFixed(0)}×${IL.photo.h.toFixed(0)}` +
    ` · 居中留白 ${IL.photo.y.toFixed(0)}/${(IL.frameH - IL.photo.y - IL.photo.h).toFixed(0)}`
);
if (Math.abs(IL.frameW / IL.frameH - 0.8) > 0.001) {
  fails += 1;
  console.log('✗ 卡纸 + 4:5 没有产出 4:5 画布');
}

// 绘制冒烟测试：假 context，只验证参数合法
function mockCtx(w, h) {
  const grad = { addColorStop() {} };
  const images = [];
  const texts = [];
  const ctx = {
    canvas: { width: w, height: h },
    filter: 'none',
    measureText: (t) => ({ width: String(t).length * 9 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    moveTo() {},
    arc() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    drawImage(...a) {
      images.push(a.slice(1));
    },
    fillText(t, x, y) {
      texts.push([t, x, y]);
    },
  };
  return { ctx, images, texts };
}

const logo = { naturalWidth: 360, naturalHeight: 120, width: 360, height: 120 };
let smokeFails = 0;

for (const style of styles) {
  for (const pos of POS9) {
    const s = { ...DEFAULT_SETTINGS, ...PRESETS[style], style, logoPos: pos };
    const L = computeLayout(photo, s);
    const S = 2;
    const W = Math.round(L.frameW * S);
    const H = Math.round(L.frameH * S);
    const { ctx, images, texts } = mockCtx(W, H);
    try {
      renderFrame(ctx, { width: 1600, height: 1200 }, L, s, S, logo);
    } catch (err) {
      smokeFails += 1;
      console.log(`✗ 渲染抛错 ${style}/${pos}:`, err.message);
      continue;
    }
    for (const [x, y, w, h] of images) {
      if (![x, y, w, h].every((v) => typeof v === 'number' && Number.isFinite(v))) {
        smokeFails += 1;
        console.log(`✗ drawImage 参数非法 ${style}/${pos}:`, [x, y, w, h]);
        break;
      }
    }
    for (const [t, x, y] of texts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        smokeFails += 1;
        console.log(`✗ 文字坐标非法 ${style}/${pos}:`, t, x, y);
        break;
      }
    }
  }
}
console.log(
  smokeFails === 0
    ? `\n绘制冒烟：${styles.length} 样式 × ${POS9.length} 位置，全部正常`
    : `\n绘制冒烟：${smokeFails} 项异常`
);
fails += smokeFails;

console.log(fails === 0 ? '\n全部通过' : `\n${fails} 项异常`);
process.exit(fails === 0 ? 0 : 1);
