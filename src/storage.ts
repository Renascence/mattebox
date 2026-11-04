/**
 * 水印 Logo 的本地缓存。
 * 存 data URL 到 localStorage：刷新后自动恢复，不需要用户重新上传。
 * 上传时先按长边 1024 缩一次图，避免大图撑爆 5MB 配额。
 */

const LOGO_KEY = 'mattebox.logo.v1';
/** 缩图后的长边上限：水印最大只画到照片宽度的 40%，1024 已经绰绰有余 */
const MAX_SIDE = 1024;
/** 超过这个体积就不缓存了，免得占满 localStorage（按 UTF-16 计约 3MB） */
const MAX_BYTES = 1_500_000;

export interface LoadedLogo {
  el: HTMLImageElement;
  url: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.decoding = 'async';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('decode'));
    el.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('read'));
    fr.readAsDataURL(file);
  });
}

/** 读文件 → 必要时缩图 → 返回可直接绘制的图片 */
export async function prepareLogo(file: File): Promise<LoadedLogo> {
  let url = await readAsDataUrl(file);
  let el = await loadImage(url);

  const maxSide = Math.max(el.naturalWidth, el.naturalHeight);
  if (maxSide > MAX_SIDE) {
    const k = MAX_SIDE / maxSide;
    const w = Math.max(1, Math.round(el.naturalWidth * k));
    const h = Math.max(1, Math.round(el.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(el, 0, 0, w, h);
      // 有透明通道的格式保持 PNG，照片类保持 JPEG
      const keepAlpha = file.type !== 'image/jpeg';
      url = c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.92);
      el = await loadImage(url);
    }
  }

  return { el, url };
}

export function readStoredLogo(): string | null {
  try {
    return localStorage.getItem(LOGO_KEY);
  } catch {
    return null;
  }
}

/** 写入缓存，返回是否成功（体积过大或存储不可用时返回 false） */
export function writeStoredLogo(url: string): boolean {
  try {
    if (url.length > MAX_BYTES) {
      localStorage.removeItem(LOGO_KEY);
      return false;
    }
    localStorage.setItem(LOGO_KEY, url);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredLogo() {
  try {
    localStorage.removeItem(LOGO_KEY);
  } catch {
    /* 存储不可用就算了 */
  }
}

/** 从缓存恢复，解不出来就顺手清掉 */
export async function restoreLogo(): Promise<LoadedLogo | null> {
  const url = readStoredLogo();
  if (!url) return null;
  try {
    const el = await loadImage(url);
    return { el, url };
  } catch {
    clearStoredLogo();
    return null;
  }
}
