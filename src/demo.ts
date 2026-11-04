import sampleUrl from './assets/sample.webp';
import type { Photo } from './render';

/** 示例照片附带的参数文字（示例图本身没有 EXIF，写一行示意） */
export const SAMPLE_EXIF = '35mm · f/1.8 · 1/250s · ISO 200';

/** 载入内置示例照片，让手边没图的人也能立刻看到效果 */
export async function makeDemoPhoto(): Promise<Photo> {
  const el = new Image();
  el.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('示例图加载失败'));
    el.src = sampleUrl;
  });
  return {
    el,
    width: el.naturalWidth,
    height: el.naturalHeight,
    name: 'coastal-road',
  };
}
