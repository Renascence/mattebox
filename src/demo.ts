import type { Photo } from './render';

/** 示例照片附带的参数文字（示例图本身没有 EXIF，写一行示意） */
export const SAMPLE_EXIF = '35mm · f/1.8 · 1/250s · ISO 200';

/**
 * 示例大图放在 public/media/ 下，**故意不进打包**：
 * 它 100KB，只有用户真去点「用示例照片」时才需要，所以做成独立文件按需请求。
 * 用 BASE_URL 拼路径，这样 base 改成 './' 或 '/repo/' 都能解析对。
 */
const SAMPLE_URL = `${import.meta.env.BASE_URL}media/sample.webp`;

/** 载入内置示例照片，让手边没图的人也能立刻看到效果 */
export async function makeDemoPhoto(): Promise<Photo> {
  const el = new Image();
  el.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('示例图加载失败'));
    el.src = SAMPLE_URL;
  });
  return {
    el,
    width: el.naturalWidth,
    height: el.naturalHeight,
    name: 'coastal-road',
  };
}
