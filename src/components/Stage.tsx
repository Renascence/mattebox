import { useEffect, useRef, useState, type DragEvent } from 'react';
import { computeLayout, renderFrame, type PhotoItem } from '../render';
import sampleThumb from '../assets/sample-thumb.webp';

interface Props {
  item: PhotoItem | null;
  logo: HTMLImageElement | null;
  onFiles: (files: File[]) => void;
  onPick: () => void;
  onDemo: () => void | Promise<void>;
  onPreview: () => void;
}

export default function Stage({ item, logo, onFiles, onPick, onDemo, onPreview }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!item || !box.w || !box.h) return;
    const c = canvasRef.current;
    if (!c) return;
    const { photo, settings } = item;
    const L = computeLayout(photo, settings);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const padX = box.w < 700 ? 20 : 56;
    const padY = box.h < 500 ? 20 : 48;
    const S = Math.max(
      0.02,
      Math.min((box.w - padX * 2) / L.frameW, (box.h - padY * 2) / L.frameH)
    );
    const cssW = L.frameW * S;
    const cssH = L.frameH * S;

    c.width = Math.max(1, Math.round(cssW * dpr));
    c.height = Math.max(1, Math.round(cssH * dpr));
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;

    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    renderFrame(ctx, photo.el, L, settings, S * dpr, logo);
  }, [item, logo, box]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={`stage${drag ? ' dragging' : ''}`}
      ref={wrapRef}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      {item ? (
        <>
          <div className="canvas-wrap">
            <div
              className="canvas-hit"
              role="button"
              tabIndex={0}
              title="点击全屏预览"
              onClick={onPreview}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPreview();
                }
              }}
            >
              <canvas ref={canvasRef} />
              <span className="canvas-hint">全屏预览</span>
            </div>
          </div>
          {drag && <div className="drop-veil">松手添加照片</div>}
        </>
      ) : (
        <div className="empty">
          <div className="empty-art">
            <img src={sampleThumb} alt="" width={66} height={44} decoding="async" />
          </div>
          <h2>把照片拖进来</h2>
          <p>支持一次拖入多张，也可以点击选择文件或 ⌘V 粘贴</p>
          <div className="empty-actions">
            <button className="btn primary" onClick={onPick}>
              选择照片
            </button>
            <button
              className="btn ghost"
              disabled={demoBusy}
              onClick={async () => {
                setDemoBusy(true);
                try {
                  await onDemo();
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {demoBusy ? '正在载入…' : '用示例照片'}
            </button>
          </div>
          <p className="empty-hint">照片只在本机浏览器里处理，不会上传</p>
        </div>
      )}
    </div>
  );
}
