import type { Settings } from './types';

export interface Photo {
  el: HTMLImageElement;
  width: number;
  height: number;
  name: string;
}

/** 一张照片 + 它自己的参数（批量模式下每张可以独立调） */
export interface PhotoItem {
  id: string;
  photo: Photo;
  settings: Settings;
  /** 参数文字是否来自自动读取的 EXIF */
  exifAuto?: boolean;
}

/** 布局参考系：长边 = 1000 单位 */
export const UNIT = 1000;

export interface Layout {
  frameW: number;
  frameH: number;
  photo: { x: number; y: number; w: number; h: number };
  /** 四周留白（短边百分比换算后的单位值） */
  margin: number;
  /** 底部总高度（含基础边距） */
  band: number;
}

const ASPECT: Record<string, number> = {
  '1:1': 1,
  '4:5': 0.8,
  '3:2': 1.5,
  '16:9': 16 / 9,
  '5:7': 5 / 7,
};

/** 画幅选「原始」时紧贴照片（画布 = 照片 + 边距，四边等宽）；其余情况先定画布，再把照片放进去 */
export function usesFrameAspect(s: Settings) {
  return s.aspect !== 'original';
}

export function computeLayout(photo: Photo, s: Settings): Layout {
  const iw = photo.width;
  const ih = photo.height;
  const k = UNIT / Math.max(iw, ih);
  const pw = iw * k;
  const ph = ih * k;
  const m = (s.borderPct / 100) * Math.min(pw, ph);

  // 贴着照片走：卡纸装裱 / 拍立得（画幅 = 原始）
  if (!usesFrameAspect(s)) {
    const extra = m * s.bottomWeight;
    return {
      frameW: pw + m * 2,
      frameH: ph + m + extra + m,
      photo: { x: m, y: m, w: pw, h: ph },
      margin: m,
      band: m + extra,
    };
  }

  // 由画幅比例驱动：固定画幅的留白 / 模糊氛围 / 出血
  const ratio = s.aspect === 'original' ? pw / ph : ASPECT[s.aspect] ?? pw / ph;
  const frameW = ratio >= 1 ? UNIT : UNIT * ratio;
  const frameH = ratio >= 1 ? UNIT / ratio : UNIT;

  const m2 = (s.borderPct / 100) * Math.min(frameW, frameH);
  const extra = m2 * s.bottomWeight;
  const inner = {
    x: m2,
    y: m2,
    w: frameW - m2 * 2,
    h: frameH - m2 - extra - m2,
  };
  const cover = s.style === 'bleed';
  const sc = cover
    ? Math.max(inner.w / iw, inner.h / ih)
    : Math.min(inner.w / iw, inner.h / ih);
  const w = iw * sc;
  const h = ih * sc;

  return {
    frameW,
    frameH,
    photo: {
      x: inner.x + (inner.w - w) / 2,
      y: inner.y + (inner.h - h) / 2,
      w,
      h,
    },
    margin: m2,
    band: m2 + extra,
  };
}

const HAS_FILTER = (() => {
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return false;
    c.filter = 'blur(2px)';
    return c.filter === 'blur(2px)';
  } catch {
    return false;
  }
})();

function addRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (rr < 0.5) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const r = Math.max(w / iw, h / ih);
  const dw = iw * r;
  const dh = ih * r;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** 不支持 ctx.filter 时的降级模糊：缩小再放大 */
function softBlurCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  blurPx: number
) {
  const factor = Math.max(2, Math.round(blurPx / 2));
  const tw = Math.max(2, Math.round(w / factor));
  const th = Math.max(2, Math.round(h / factor));
  const tmp = document.createElement('canvas');
  tmp.width = tw;
  tmp.height = th;
  const tc = tmp.getContext('2d');
  if (!tc) return;
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  drawCover(tc, img, 0, 0, tw, th);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
  ctx.restore();
}

function drawAmbientBg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  s: Settings,
  S: number
) {
  const blurPx = Math.max(0, s.blur * S);
  const pad = Math.max(10, blurPx * 1.8);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (HAS_FILTER && blurPx > 0.5) {
    ctx.filter = `blur(${blurPx}px)`;
    // 放大铺满，overscan 盖住模糊产生的透明边
    drawCover(ctx, img, -pad, -pad, W + pad * 2, H + pad * 2);
    ctx.filter = 'none';
  } else if (blurPx > 0.5) {
    softBlurCover(ctx, img, -pad, -pad, W + pad * 2, H + pad * 2, blurPx);
  } else {
    drawCover(ctx, img, 0, 0, W, H);
  }
  ctx.restore();

  if (s.dim > 0.001) {
    ctx.fillStyle = `rgba(0,0,0,${s.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawWindowShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  strength: number
) {
  if (strength <= 0.005) return;
  const blurPx = Math.min(w, h) * 0.055 * strength + 2;
  const pad = blurPx * 3 + 12;

  ctx.save();
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.shadowColor = `rgba(0,0,0,${0.68 * Math.min(1, strength)})`;
  ctx.shadowBlur = blurPx;
  ctx.shadowOffsetY = blurPx * 0.2;

  ctx.beginPath();
  ctx.rect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  addRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#000';
  ctx.fill('evenodd');
  ctx.restore();
}

const POS_ANCHOR: Record<string, [number, number]> = {
  tl: [0, 0],
  tc: [0.5, 0],
  tr: [1, 0],
  ml: [0, 0.5],
  mc: [0.5, 0.5],
  mr: [1, 0.5],
  bl: [0, 1],
  bc: [0.5, 1],
  br: [1, 1],
};

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  s: Settings
) {
  const nw = logo.naturalWidth || logo.width;
  const nh = logo.naturalHeight || logo.height;
  if (!nw || !nh) return;

  let lw = (s.logoScale / 100) * w;
  let lh = lw * (nh / nw);
  const maxH = h * 0.32;
  if (lh > maxH) {
    lh = maxH;
    lw = lh * (nw / nh);
  }

  const pad = (s.logoInset / 100) * Math.min(w, h);
  const [fx, fy] = POS_ANCHOR[s.logoPos] ?? POS_ANCHOR.br;
  const lx = x + pad + Math.max(0, w - lw - pad * 2) * fx;
  const ly = y + pad + Math.max(0, h - lh - pad * 2) * fy;

  ctx.save();
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.globalAlpha = Math.max(0, Math.min(1, s.logoOpacity));
  ctx.drawImage(logo, lx, ly, lw, lh);
  ctx.restore();
}

/** 取 #rrggbb 的相对亮度，用来决定留白上的文字是深还是浅 */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** 按最大宽度自动缩字号，返回最终字号 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  template: string,
  size: number,
  maxW: number,
  min: number
) {
  const build = (v: number) => template.replace('{s}', v.toFixed(1));
  let fs = size;
  ctx.font = build(fs);
  let guard = 0;
  while (ctx.measureText(text).width > maxW && fs > min && guard++ < 48) {
    fs *= 0.94;
    ctx.font = build(fs);
  }
  return fs;
}

function drawBandText(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  s: Settings,
  S: number,
  W: number
) {
  const bandTop = (L.photo.y + L.photo.h) * S;
  const bandH = (L.frameH - L.photo.y - L.photo.h) * S;
  if (bandH < 10) return;

  const caption = s.caption.trim();
  const exif = s.showExif ? s.exifLine.trim() : '';
  if (!caption && !exif) return;

  const onBlur = s.style === 'blur';
  const dark = onBlur || luminance(s.paper) < 0.45;
  const capColor = dark ? 'rgba(255,255,255,0.82)' : 'rgba(26,24,21,0.76)';
  const exColor = dark ? 'rgba(255,255,255,0.58)' : 'rgba(26,24,21,0.56)';

  const capSize = Math.min(bandH * 0.3, W * 0.045);
  const exSize = Math.min(bandH * 0.19, W * 0.026);
  const gap = caption && exif ? bandH * 0.07 : 0;
  const blockH = (caption ? capSize : 0) + gap + (exif ? exSize : 0);
  let top = bandTop + Math.max(0, (bandH - blockH) / 2);

  const serif = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  const sans = '-apple-system, "Helvetica Neue", "PingFang SC", Arial, sans-serif';

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (onBlur) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.max(2, exSize * 0.6);
  }

  if (caption) {
    const tpl = `italic {s}px ${serif}`;
    fitFont(ctx, caption, tpl, capSize, W * 0.82, 6);
    ctx.fillStyle = capColor;
    ctx.fillText(caption, W / 2, top + capSize / 2);
    top += capSize + gap;
  }

  if (exif) {
    const tpl = `{s}px ${sans}`;
    fitFont(ctx, exif, tpl, exSize, W * 0.86, 5);
    ctx.fillStyle = exColor;
    ctx.fillText(exif, W / 2, top + exSize / 2);
  }
  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  L: Layout,
  s: Settings,
  S: number,
  logo?: HTMLImageElement | null
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (s.style === 'blur') {
    drawAmbientBg(ctx, img, W, H, s, S);
  } else {
    ctx.fillStyle = s.paper;
    ctx.fillRect(0, 0, W, H);
  }

  const x = L.photo.x * S;
  const y = L.photo.y * S;
  const w = L.photo.w * S;
  const h = L.photo.h * S;
  const r = Math.max(0, s.radius * S);

  // 照片本体
  ctx.save();
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  // 窗洞阴影：卡纸压住照片边缘的那一层暗
  drawWindowShadow(ctx, x, y, w, h, r, s.shadow);

  // 发丝线
  if (s.hairline) {
    const lw = Math.max(1, S * 0.8);
    ctx.save();
    ctx.beginPath();
    addRoundRect(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
    ctx.strokeStyle = 'rgba(20,18,16,0.16)';
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.restore();
  }

  // 水印（贴在照片上，按九宫格定位）
  if (logo) {
    drawLogo(ctx, logo, x, y, w, h, r, s);
  }

  // 下方留白：题注 + 照片参数
  drawBandText(ctx, L, s, S, W);
}

export function renderToCanvas(
  photo: Photo,
  s: Settings,
  longEdge: number,
  logo?: HTMLImageElement | null
): HTMLCanvasElement {
  const L = computeLayout(photo, s);
  const S = longEdge / Math.max(L.frameW, L.frameH);
  const c = document.createElement('canvas');
  c.width = Math.round(L.frameW * S);
  c.height = Math.round(L.frameH * S);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  renderFrame(ctx, photo.el, L, s, S, logo);
  return c;
}

export function framePixelSize(photo: Photo, s: Settings, longEdge: number) {
  const L = computeLayout(photo, s);
  const S = longEdge / Math.max(L.frameW, L.frameH);
  return {
    w: Math.round(L.frameW * S),
    h: Math.round(L.frameH * S),
    ratio: L.frameW / L.frameH,
  };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
