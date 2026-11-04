import { useEffect, useRef, useState } from 'react';
import { computeLayout, framePixelSize, renderFrame, type PhotoItem } from '../render';

interface Props {
  item: PhotoItem;
  logo: HTMLImageElement | null;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/** 背板长边上限，避免在 5K 屏上画出上万像素的 canvas */
const MAX_BACKING = 4096;

export default function Lightbox({ item, logo, index, total, onClose, onPrev, onNext }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!box.w || !box.h) return;
    const c = canvasRef.current;
    if (!c) return;
    const { photo, settings } = item;
    const L = computeLayout(photo, settings);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // 全屏下留白收窄一点，让画面尽量大；窄屏再收
    const padX = box.w < 720 ? 24 : 80;
    const padY = box.h < 560 ? 20 : 40;

    // 先按可用空间求贴合比例，再按物理像素上限回压
    const fit = Math.max(
      0.02,
      Math.min((box.w - padX * 2) / L.frameW, (box.h - padY * 2) / L.frameH)
    );
    const longCss = Math.max(L.frameW, L.frameH) * fit;
    const cap = MAX_BACKING / dpr;
    const k = longCss > cap ? cap / longCss : 1;

    const cssW = L.frameW * fit * k;
    const cssH = L.frameH * fit * k;
    c.width = Math.max(1, Math.round(cssW * dpr));
    c.height = Math.max(1, Math.round(cssH * dpr));
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;

    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    renderFrame(ctx, photo.el, L, settings, fit * k * dpr, logo);
  }, [item, logo, box]);

  // Esc 关闭、左右切图；同时锁住背后页面的滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && total > 1) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && total > 1) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onNext, onPrev, total]);

  const out = framePixelSize(item.photo, item.settings, item.settings.longEdge);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="全屏预览" onClick={onClose}>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <div className="lb-title">
          <span className="lb-name">{item.photo.name}</span>
          <span className="lb-meta">
            {out.w} × {out.h}
          </span>
        </div>
        <div className="lb-actions">
          {total > 1 && (
            <span className="lb-count">
              {index + 1} / {total}
            </span>
          )}
          <button className="lb-btn" onClick={onClose} aria-label="关闭全屏预览">
            ✕
          </button>
        </div>
      </div>

      <div className="lb-stage" ref={boxRef} onClick={onClose}>
        <canvas key={item.id} ref={canvasRef} />
      </div>

      {total > 1 && (
        <>
          <button
            className="lb-nav prev"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="上一张"
          >
            ‹
          </button>
          <button
            className="lb-nav next"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="下一张"
          >
            ›
          </button>
        </>
      )}

      <div className="lb-hint">
        点击任意处或 Esc 关闭{total > 1 ? ' · ← → 切换照片' : ''}
      </div>
    </div>
  );
}
