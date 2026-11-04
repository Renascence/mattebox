export type StyleId = 'matte' | 'polaroid' | 'blur' | 'bleed';
export type AspectId = 'original' | '1:1' | '4:5' | '3:2' | '16:9' | '5:7';
export type Format = 'png' | 'jpeg';
/** 水印九宫格位置 */
export type Pos9 = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export const POS9: Pos9[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

export const POS_LABEL: Record<Pos9, string> = {
  tl: '左上',
  tc: '上中',
  tr: '右上',
  ml: '左中',
  mc: '居中',
  mr: '右中',
  bl: '左下',
  bc: '下中',
  br: '右下',
};

export interface Settings {
  style: StyleId;
  /** 边框宽度，按短边的百分比 */
  borderPct: number;
  /** 底部额外加重的倍数（相对左右边距） */
  bottomWeight: number;
  /** 卡纸 / 底色 */
  paper: string;
  /** 画幅比例（仅填充类样式生效） */
  aspect: AspectId;
  /** 背景模糊半径，1000 单位参考系下的像素值 */
  blur: number;
  /** 背景暗色遮罩强度 0~1 */
  dim: number;
  /** 窗边阴影强度 0~1 */
  shadow: number;
  /** 圆角，1000 单位参考系下的像素值 */
  radius: number;
  /** 画面内发丝线 */
  hairline: boolean;
  /** 拍立得题注 */
  caption: string;
  /** 水印位置 */
  logoPos: Pos9;
  /** 水印宽度，占照片宽度的百分比 */
  logoScale: number;
  /** 水印距画面边缘的内边距，占照片短边的百分比 */
  logoInset: number;
  /** 水印不透明度 0~1 */
  logoOpacity: number;
  /** 是否在下方留白显示照片参数 */
  showExif: boolean;
  /** 参数文字（自动读取 EXIF，可手改） */
  exifLine: string;
  format: Format;
  longEdge: number;
  quality: number;
}

export interface StyleMeta {
  id: StyleId;
  name: string;
  en: string;
  desc: string;
}

export const STYLES: StyleMeta[] = [
  {
    id: 'matte',
    name: '卡纸装裱',
    en: 'Passe-partout / Matte',
    desc: '美术馆挂画的做法。白卡纸留边，窗洞边缘有一层落在照片上的阴影。画幅选「原始」紧贴照片，选固定比例就是印刷说的白边 / UI 的 inset frame。',
  },
  {
    id: 'polaroid',
    name: '拍立得',
    en: 'Polaroid frame',
    desc: '三边细边、底部大片留白，没有窗边阴影，可以写一行题注。',
  },
  {
    id: 'blur',
    name: '模糊氛围',
    en: 'Blur fill / Ambient',
    desc: '同一张图放大模糊铺满背景，清晰图居中，再压一层暗色遮罩压住喧闹。',
  },
  {
    id: 'bleed',
    name: '出血满幅',
    en: 'Bleed',
    desc: '画面直接顶到纸边，不留白。只做裁切与圆角。',
  },
];

export const DEFAULT_SETTINGS: Settings = {
  style: 'matte',
  borderPct: 8,
  bottomWeight: 0.35,
  paper: '#f4f1ea',
  aspect: 'original',
  blur: 34,
  dim: 0.3,
  shadow: 0.55,
  radius: 0,
  hairline: true,
  caption: '',
  logoPos: 'br',
  logoScale: 12,
  logoInset: 6,
  logoOpacity: 0.85,
  showExif: true,
  exifLine: '',
  format: 'png',
  longEdge: 2048,
  quality: 0.92,
};

export const PRESETS: Record<StyleId, Partial<Settings>> = {
  matte: { borderPct: 8, bottomWeight: 0.35, paper: '#f4f1ea', aspect: 'original', shadow: 0.55, hairline: true, radius: 0 },
  polaroid: { borderPct: 6.5, bottomWeight: 3.2, paper: '#fbfaf7', aspect: 'original', shadow: 0.16, hairline: false, radius: 0 },
  blur: { borderPct: 5, bottomWeight: 0, paper: '#101114', aspect: 'original', blur: 34, dim: 0.3, shadow: 0.5, hairline: false, radius: 0 },
  bleed: { borderPct: 0, bottomWeight: 0, paper: '#101114', aspect: 'original', shadow: 0, hairline: false, radius: 0 },
};

export const ASPECTS: { id: AspectId; label: string }[] = [
  { id: 'original', label: '原始' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '3:2', label: '3:2' },
  { id: '16:9', label: '16:9' },
  { id: '5:7', label: '5:7' },
];

export const PAPERS = [
  { value: '#fbfaf7', name: '画廊白' },
  { value: '#f4f1ea', name: '米白' },
  { value: '#efe6d4', name: '象牙' },
  { value: '#e4dbcb', name: '暖灰' },
  { value: '#1b1d21', name: '墨黑' },
  { value: '#2b3440', name: '石板' },
];

export const SIZES = [1080, 2048, 3072, 4096];
