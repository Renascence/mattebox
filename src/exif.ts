/**
 * 极简 EXIF 读取：只解析 JPEG 的 APP1 / TIFF IFD，取机身、镜头、光圈、快门、ISO、焦距。
 * 不依赖任何库，PNG / WebP 之类没有 EXIF 的文件直接返回空对象。
 */

export interface ExifInfo {
  make?: string;
  model?: string;
  lens?: string;
  focal?: number;
  focal35?: number;
  fNumber?: number;
  exposure?: number;
  iso?: number;
  date?: string;
}

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};

function readValue(
  dv: DataView,
  tiff: number,
  p: number,
  type: number,
  count: number,
  le: boolean
): string | number | number[] | undefined {
  const unit = TYPE_SIZE[type];
  if (!unit || count <= 0) return undefined;
  const total = unit * count;
  const base = total > 4 ? tiff + dv.getUint32(p, le) : p;
  if (base < 0 || base + total > dv.byteLength) return undefined;

  if (type === 2) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const c = dv.getUint8(base + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim();
  }
  if (type === 3) {
    if (count === 1) return dv.getUint16(base, le);
    return Array.from({ length: count }, (_, i) => dv.getUint16(base + i * 2, le));
  }
  if (type === 4) {
    if (count === 1) return dv.getUint32(base, le);
    return Array.from({ length: count }, (_, i) => dv.getUint32(base + i * 4, le));
  }
  if (type === 9) return dv.getInt32(base, le);
  if (type === 5) {
    const num = dv.getUint32(base, le);
    const den = dv.getUint32(base + 4, le);
    return den ? num / den : undefined;
  }
  if (type === 10) {
    const num = dv.getInt32(base, le);
    const den = dv.getInt32(base + 4, le);
    return den ? num / den : undefined;
  }
  return undefined;
}

function readIFD(dv: DataView, tiff: number, offset: number, le: boolean) {
  const map = new Map<number, string | number | number[]>();
  if (offset < 0 || offset + 2 > dv.byteLength) return map;
  const count = dv.getUint16(offset, le);
  for (let i = 0; i < count; i++) {
    const e = offset + 2 + i * 12;
    if (e + 12 > dv.byteLength) break;
    const tag = dv.getUint16(e, le);
    const type = dv.getUint16(e + 2, le);
    const n = dv.getUint32(e + 4, le);
    const val = readValue(dv, tiff, e + 8, type, n, le);
    if (val !== undefined) map.set(tag, val);
  }
  return map;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
const firstNum = (v: unknown) => {
  if (Array.isArray(v)) return num(v[0]);
  return num(v);
};

export function parseExif(buffer: ArrayBuffer): ExifInfo {
  const out: ExifInfo = {};
  try {
    const dv = new DataView(buffer);
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return out;

    let pos = 2;
    let tiff = -1;
    while (pos + 4 <= dv.byteLength) {
      if (dv.getUint8(pos) !== 0xff) break;
      const marker = dv.getUint8(pos + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      if (marker === 0xda || marker === 0xd9) break;
      const size = dv.getUint16(pos + 2);
      if (size < 2) break;
      if (marker === 0xe1 && size >= 8 && dv.getUint32(pos + 4) === 0x45786966) {
        tiff = pos + 10;
        break;
      }
      pos += 2 + size;
    }
    if (tiff < 0 || tiff + 8 > dv.byteLength) return out;

    const le = dv.getUint16(tiff) === 0x4949;
    if (dv.getUint16(tiff + 2, le) !== 0x002a) return out;

    const ifd0 = readIFD(dv, tiff, tiff + dv.getUint32(tiff + 4, le), le);
    const exifPtr = ifd0.get(0x8769);
    const ifd1 =
      typeof exifPtr === 'number' ? readIFD(dv, tiff, tiff + exifPtr, le) : new Map();

    out.make = str(ifd0.get(0x010f));
    out.model = str(ifd0.get(0x0110));
    out.lens = str(ifd1.get(0xa434)) || str(ifd0.get(0xa434));
    out.focal = firstNum(ifd1.get(0x920a));
    out.focal35 = firstNum(ifd1.get(0xa405));
    out.fNumber = firstNum(ifd1.get(0x829d));
    out.exposure = firstNum(ifd1.get(0x829a));
    out.iso = firstNum(ifd1.get(0x8827)) ?? firstNum(ifd1.get(0x8833));
    out.date = str(ifd1.get(0x9003));
  } catch {
    /* 损坏的 EXIF 就当没有 */
  }
  return out;
}

function cameraName(e: ExifInfo): string {
  const rawMake = (e.make ?? '').replace(/\s+/g, ' ').trim();
  const make = rawMake
    .replace(/\b(CORPORATION|CORP\.?|INC\.?|CO\.,?\s*LTD\.?|IMAGING|OPTICAL|COMPANY)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const model = (e.model ?? '').replace(/\s+/g, ' ').trim();
  if (!make) return model;
  if (!model) return make;
  const head = make.split(' ')[0].toUpperCase();
  if (model.toUpperCase().startsWith(head)) return model;
  return `${make} ${model}`;
}

function shutter(t: number): string {
  if (t >= 1) return `${Number.isInteger(t) ? t : t.toFixed(1)}s`;
  return `1/${Math.round(1 / t)}s`;
}

/** 拼成一行印刷风格的参数：机身 · 镜头 · 焦距 · 光圈 · 快门 · ISO */
export function formatExif(e: ExifInfo): string {
  const parts: string[] = [];
  const cam = cameraName(e);
  if (cam) parts.push(cam.toUpperCase());
  if (e.lens) parts.push(e.lens);
  const focal = e.focal35 ?? (e.focal ? Math.round(e.focal) : undefined);
  if (focal) parts.push(`${focal}mm`);
  if (e.fNumber) {
    parts.push(`f/${e.fNumber >= 10 ? Math.round(e.fNumber) : e.fNumber.toFixed(1)}`);
  }
  if (e.exposure) parts.push(shutter(e.exposure));
  if (e.iso) parts.push(`ISO ${Math.round(e.iso)}`);
  return parts.join(' · ');
}
