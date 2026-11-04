import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Stage from './components/Stage';
import Filmstrip from './components/Filmstrip';
import Panel from './components/Panel';
import Lightbox from './components/Lightbox';
import { DEFAULT_SETTINGS, PRESETS, STYLES, type Settings, type StyleId } from './types';
import {
  canvasToBlob,
  framePixelSize,
  renderToCanvas,
  type Photo,
  type PhotoItem,
} from './render';
import { makeDemoPhoto, SAMPLE_EXIF } from './demo';
import { formatExif, parseExif } from './exif';
import { clearStoredLogo, prepareLogo, restoreLogo, writeStoredLogo } from './storage';

const STORAGE_KEY = 'mattebox.settings.v1';

function loadTemplate(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed };
      // 老版本的「白边留白」已经并进卡纸装裱：转成卡纸 + 固定画幅
      const legacy = (parsed as { style?: string }).style;
      if (legacy === 'inset') {
        merged.style = 'matte';
        merged.aspect = parsed.aspect && parsed.aspect !== 'original' ? parsed.aspect : '4:5';
      }
      if (!STYLES.some((x) => x.id === merged.style)) merged.style = 'matte';
      return merged;
    }
  } catch {
    /* 忽略损坏的本地数据 */
  }
  return DEFAULT_SETTINGS;
}

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'photo';
}

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function loadPhotoFile(file: File): Promise<{ photo: Photo; exifLine: string }> {
  const url = URL.createObjectURL(file);
  const el = new Image();
  el.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('decode'));
    el.src = url;
  });

  let exifLine = '';
  try {
    exifLine = formatExif(parseExif(await file.arrayBuffer()));
  } catch {
    exifLine = '';
  }

  return {
    photo: {
      el,
      width: el.naturalWidth,
      height: el.naturalHeight,
      name: cleanName(file.name),
    },
    exifLine,
  };
}

export default function App() {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 新照片继承的模板参数，同时也是持久化的对象 */
  const [template, setTemplate] = useState<Settings>(loadTemplate);
  const [logo, setLogo] = useState<{ el: HTMLImageElement; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const active = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId]
  );
  const settings = active?.settings ?? template;

  const activeIndex = useMemo(
    () => items.findIndex((i) => i.id === activeId),
    [items, activeId]
  );

  /** 全屏预览里左右切图，到头绕回另一端 */
  const stepPhoto = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      const from = activeIndex < 0 ? 0 : activeIndex;
      setActiveId(items[(from + delta + items.length) % items.length].id);
    },
    [activeIndex, items]
  );

  // 预览中的照片被删掉就自动退出
  useEffect(() => {
    if (previewing && !active) setPreviewing(false);
  }, [active, previewing]);

  const openPreview = useCallback(() => setPreviewing(true), []);
  const closePreview = useCallback(() => setPreviewing(false), []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
      } catch {
        /* 存储满了就算了 */
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [template]);

  /** 改动当前照片的参数，同时同步模板（新照片继承、刷新后保留） */
  const patch = useCallback(
    (mut: (s: Settings) => Settings) => {
      setTemplate((t) => mut(t));
      setItems((list) =>
        list.map((i) => (i.id === activeId ? { ...i, settings: mut(i.settings) } : i))
      );
    },
    [activeId]
  );

  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      patch((s) => ({ ...s, [key]: value }));
    },
    [patch]
  );

  const applyStyle = useCallback(
    (id: StyleId) => {
      patch((s) => ({ ...s, style: id, ...PRESETS[id] }));
    },
    [patch]
  );

  // 启动时恢复上次用过的水印 Logo
  useEffect(() => {
    let alive = true;
    void restoreLogo().then((saved) => {
      if (alive && saved) setLogo(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith('image/'));
      if (!list.length) {
        notify('没有可用的图片');
        return;
      }
      if (list.length > 1) setBusy(`正在载入 0/${list.length}`);
      const base = settings;
      const added: PhotoItem[] = [];

      for (let i = 0; i < list.length; i++) {
        if (list.length > 1) setBusy(`正在载入 ${i + 1}/${list.length}`);
        try {
          const { photo, exifLine } = await loadPhotoFile(list[i]);
          added.push({
            id: uid(),
            photo,
            settings: { ...base, exifLine },
            exifAuto: !!exifLine,
          });
        } catch {
          /* 单张失败就跳过 */
        }
      }
      setBusy(null);

      if (!added.length) {
        notify('照片读不出来，换几张试试');
        return;
      }
      setItems((prev) => [...prev, ...added]);
      setActiveId((prev) => prev ?? added[0].id);
      const withExif = added.filter((a) => a.settings.exifLine).length;
      notify(
        added.length > 1
          ? `已添加 ${added.length} 张${withExif ? `，${withExif} 张带拍摄参数` : ''}`
          : withExif
            ? '照片已载入，已读取拍摄参数'
            : '照片已载入'
      );
    },
    [notify, settings]
  );

  const pick = useCallback(() => fileRef.current?.click(), []);
  const pickLogo = useCallback(() => logoRef.current?.click(), []);

  const loadLogo = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        notify('Logo 需要是图片文件');
        return;
      }
      try {
        const { el, url } = await prepareLogo(file);
        setLogo({ el, url });
        const saved = writeStoredLogo(url);
        notify(saved ? 'Logo 已添加并保存' : 'Logo 已添加（文件偏大，刷新后不会保留）');
      } catch {
        notify('Logo 读不出来，换个 PNG 试试');
      }
    },
    [notify]
  );

  const removeLogo = useCallback(() => {
    setLogo(null);
    clearStoredLogo();
  }, []);

  const useDemo = useCallback(async () => {
    try {
      const demo = await makeDemoPhoto();
      const item: PhotoItem = {
        id: uid(),
        photo: demo,
        settings: { ...settings, exifLine: SAMPLE_EXIF },
        exifAuto: false,
      };
      setItems((prev) => [...prev, item]);
      setActiveId(item.id);
      notify('已载入示例照片');
    } catch {
      notify('示例图载入失败');
    }
  }, [notify, settings]);

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setActiveId((cur) => (cur === id ? (items.find((i) => i.id !== id)?.id ?? null) : cur));
    },
    [items]
  );

  /** 把当前照片的参数套用到其余所有照片，但保留各自的参数文字和题注 */
  const applyToAll = useCallback(() => {
    if (!active || items.length < 2) return;
    const base = active.settings;
    setItems((list) =>
      list.map((i) =>
        i.id === active.id
          ? i
          : {
              ...i,
              settings: {
                ...base,
                exifLine: i.settings.exifLine,
                caption: i.settings.caption,
              },
            }
      )
    );
    setTemplate(base);
    notify(`已套用到全部 ${items.length} 张`);
  }, [active, items.length, notify]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  // 分享链接参数：?demo=1 载入示例图，?style=blur 直接指定样式
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = params.get('style');
    const styled =
      st && STYLES.some((x) => x.id === st)
        ? { ...template, style: st as StyleId, ...PRESETS[st as StyleId] }
        : template;
    if (styled !== template) setTemplate(styled);

    if (params.has('demo')) {
      void makeDemoPhoto()
        .then((demo) => {
          const item: PhotoItem = {
            id: uid(),
            photo: demo,
            settings: { ...styled, exifLine: SAMPLE_EXIF },
            exifAuto: false,
          };
          setItems([item]);
          setActiveId(item.id);
        })
        .catch(() => undefined);
    }
    // 只在首次挂载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outSize = useMemo(
    () => (active ? framePixelSize(active.photo, active.settings, active.settings.longEdge) : null),
    [active]
  );

  const exportCurrent = useCallback(async () => {
    if (!active) return;
    setBusy('正在导出');
    try {
      const { photo, settings: s } = active;
      const canvas = renderToCanvas(photo, s, s.longEdge, logo?.el ?? null);
      const mime = s.format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, mime, s.quality);
      if (!blob) throw new Error('encode');
      const ext = s.format === 'png' ? 'png' : 'jpg';
      download(blob, `${photo.name}-${s.style}-${canvas.width}x${canvas.height}.${ext}`);
      notify(`已导出 ${canvas.width} × ${canvas.height}`);
    } catch {
      notify('导出失败，试试换个尺寸或格式');
    } finally {
      setBusy(null);
    }
  }, [active, logo, notify]);

  const exportAll = useCallback(async () => {
    if (!items.length) return;
    if (items.length === 1) {
      void exportCurrent();
      return;
    }
    setBusy(`正在导出 0/${items.length}`);
    try {
      let done = 0;
      for (let i = 0; i < items.length; i++) {
        setBusy(`正在导出 ${i + 1}/${items.length}`);
        const { photo, settings: s } = items[i];
        const canvas = renderToCanvas(photo, s, s.longEdge, logo?.el ?? null);
        const mime = s.format === 'png' ? 'image/png' : 'image/jpeg';
        const blob = await canvasToBlob(canvas, mime, s.quality);
        if (!blob) continue;
        const ext = s.format === 'png' ? 'png' : 'jpg';
        download(blob, `${photo.name}-${s.style}-${canvas.width}x${canvas.height}.${ext}`);
        done += 1;
        // 浏览器对连续触发的下载有节流，隔一小段再下一个，避免后半截被吞掉
        await new Promise((r) => window.setTimeout(r, 280));
      }
      notify(done ? `已导出 ${done} 张` : '没有可导出的照片');
    } catch {
      notify('批量导出失败，试试调小长边或减少张数');
    } finally {
      setBusy(null);
    }
  }, [items, logo, notify, exportCurrent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void (items.length > 1 ? exportAll() : exportCurrent());
      } else if (k === 'o') {
        e.preventDefault();
        pick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportAll, exportCurrent, items.length, pick]);

  const reset = useCallback(() => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      style: settings.style,
      ...PRESETS[settings.style],
      format: settings.format,
      longEdge: settings.longEdge,
      exifLine: settings.exifLine,
    };
    setTemplate(next);
    setItems((list) =>
      list.map((i) => (i.id === activeId ? { ...i, settings: { ...next, exifLine: i.settings.exifLine } } : i))
    );
    notify('参数已恢复');
  }, [activeId, notify, settings]);

  const count = items.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">✦</span>
          <span className="brand-name">Mattebox</span>
          <span className="brand-sub">
            {count > 1 ? `${count} 张照片 · 批量装裱` : '照片装裱 · matte / bleed / ambient'}
          </span>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={pick}>
            {count ? '添加照片' : '选择照片'}
          </button>
          <button
            className="btn primary"
            onClick={() => void (count > 1 ? exportAll() : exportCurrent())}
            disabled={!count || !!busy}
          >
            {busy ?? (count > 1 ? `导出全部 ${count} 张` : '导出')}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          <Stage
            item={active}
            logo={logo?.el ?? null}
            onFiles={addFiles}
            onPick={pick}
            onDemo={useDemo}
            onPreview={openPreview}
          />
          <Filmstrip
            items={items}
            activeId={activeId}
            logo={logo?.el ?? null}
            onSelect={setActiveId}
            onRemove={removeItem}
            onAdd={pick}
          />
        </div>
        <Panel
          settings={settings}
          update={update}
          applyStyle={applyStyle}
          onExport={exportCurrent}
          onExportAll={exportAll}
          onApplyAll={applyToAll}
          onReset={reset}
          count={count}
          outSize={outSize}
          busy={busy}
          logoUrl={logo?.url ?? null}
          onPickLogo={pickLogo}
          onRemoveLogo={removeLogo}
          exifDetected={!!active?.exifAuto}
        />
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void addFiles(files);
          e.target.value = '';
        }}
      />

      <input
        ref={logoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadLogo(f);
          e.target.value = '';
        }}
      />

      {previewing && active && (
        <Lightbox
          item={active}
          logo={logo?.el ?? null}
          index={Math.max(0, activeIndex)}
          total={items.length}
          onClose={closePreview}
          onPrev={() => stepPhoto(-1)}
          onNext={() => stepPhoto(1)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
