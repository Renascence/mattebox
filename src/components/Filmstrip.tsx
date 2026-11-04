import { useEffect, useRef } from 'react';
import { computeLayout, renderFrame, type PhotoItem } from '../render';

const BOX = 58;

function MiniPreview({ item, logo }: { item: PhotoItem; logo: HTMLImageElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 拖滑块时会连续触发，抖一下再画，避免每帧重绘一排缩略图
    const t = window.setTimeout(() => {
      const c = ref.current;
      if (!c) return;
      const L = computeLayout(item.photo, item.settings);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = Math.min(BOX / L.frameW, BOX / L.frameH);
      const w = Math.max(1, Math.round(L.frameW * S));
      const h = Math.max(1, Math.round(L.frameH * S));
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      renderFrame(ctx, item.photo.el, L, item.settings, S * dpr, logo);
    }, 90);
    return () => window.clearTimeout(t);
  }, [item, logo]);

  return <canvas ref={ref} className="mini-canvas" />;
}

interface Props {
  items: PhotoItem[];
  activeId: string | null;
  logo: HTMLImageElement | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export default function Filmstrip({ items, activeId, logo, onSelect, onRemove, onAdd }: Props) {
  if (!items.length) return null;

  return (
    <div className="strip">
      <div className="strip-list">
        {items.map((it) => (
          <div
            key={it.id}
            className={`thumb${it.id === activeId ? ' on' : ''}`}
            onClick={() => onSelect(it.id)}
            title={it.photo.name}
          >
            <div className="thumb-box">
              <MiniPreview item={it} logo={logo} />
            </div>
            <button
              type="button"
              className="thumb-x"
              title="移除这张"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(it.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="thumb-add" onClick={onAdd} title="继续添加照片">
          +
        </button>
      </div>
      <span className="strip-count">{items.length} 张</span>
    </div>
  );
}
