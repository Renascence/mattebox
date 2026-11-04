import { ASPECTS, POS_LABEL, SIZES, STYLES, type AspectId, type Format, type Settings, type StyleId } from '../types';
import { Chips, PosGrid, Section, Slider, Swatches, Thumb, Toggle } from './ui';

interface Props {
  settings: Settings;
  update: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  applyStyle: (id: StyleId) => void;
  onExport: () => void;
  onExportAll: () => void;
  onApplyAll: () => void;
  onReset: () => void;
  count: number;
  outSize: { w: number; h: number; ratio: number } | null;
  busy: string | null;
  logoUrl: string | null;
  onPickLogo: () => void;
  onRemoveLogo: () => void;
  exifDetected: boolean;
}

export default function Panel({
  settings: s,
  update,
  applyStyle,
  onExport,
  onExportAll,
  onApplyAll,
  onReset,
  count,
  outSize,
  busy,
  logoUrl,
  onPickLogo,
  onRemoveLogo,
  exifDetected,
}: Props) {
  const showBorder = s.style !== 'bleed';
  const showBottom = s.style !== 'bleed';
  const showPaper = s.style !== 'blur' && s.style !== 'bleed';
  const showCaption = s.style === 'polaroid';

  return (
    <aside className="panel">
      {count > 1 && (
        <div className="batch-bar">
          <span className="batch-text">{count} 张照片 · 参数各自独立</span>
          <button type="button" className="btn mini" onClick={onApplyAll} disabled={!!busy}>
            套用到全部
          </button>
        </div>
      )}

      <Section title="样式">
        <div className="styles">
          {STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`style-item${s.style === st.id ? ' on' : ''}`}
              onClick={() => applyStyle(st.id)}
            >
              <Thumb id={st.id} />
              <span className="style-text">
                <span className="style-name">{st.name}</span>
                <span className="style-en">{st.en}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="style-desc">{STYLES.find((x) => x.id === s.style)?.desc}</p>
      </Section>

      {(showBorder || showBottom) && (
        <Section title="边距">
          {showBorder && (
            <Slider
              label="边框宽度"
              value={s.borderPct}
              min={0}
              max={20}
              step={0.5}
              suffix="%"
              onChange={(v) => update('borderPct', v)}
            />
          )}
          {showBottom && (
            <Slider
              label="底部加重"
              value={s.bottomWeight}
              min={0}
              max={4}
              step={0.1}
              suffix="×"
              onChange={(v) => update('bottomWeight', v)}
            />
          )}
        </Section>
      )}

      {showPaper && (
        <Section title="卡纸颜色">
          <Swatches value={s.paper} onChange={(v) => update('paper', v)} />
        </Section>
      )}

      <Section title="画幅">
        <Chips<AspectId>
          options={ASPECTS}
          value={s.aspect}
          onChange={(v) => update('aspect', v)}
        />
        <p className="note">
          「原始」紧贴照片，留白均匀。选固定比例，照片就浮在画布中间——这就是印刷说的
          <b> 白边 </b>、UI 说的 inset frame，适合做 1:1 / 4:5 的社交图。
        </p>
      </Section>

      {s.style === 'blur' && (
        <Section title="氛围背景">
          <Slider
            label="模糊半径"
            value={s.blur}
            min={0}
            max={80}
            step={1}
            onChange={(v) => update('blur', v)}
          />
          <Slider
            label="暗色遮罩"
            value={Math.round(s.dim * 100)}
            min={0}
            max={80}
            step={1}
            suffix="%"
            onChange={(v) => update('dim', v / 100)}
          />
          <p className="note">
            同一张图铺满画布，<code>blur + 放大 1.15×</code> 盖住模糊产生的透明边，再叠清晰图。
          </p>
        </Section>
      )}

      <Section title="细节">
        <Slider
          label="窗边阴影"
          value={Math.round(s.shadow * 100)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => update('shadow', v / 100)}
        />
        <Slider
          label="圆角"
          value={s.radius}
          min={0}
          max={60}
          step={1}
          onChange={(v) => update('radius', v)}
        />
        <Toggle
          label="画面发丝线"
          checked={s.hairline}
          onChange={(v) => update('hairline', v)}
        />
        {showCaption && (
          <div className="field">
            <div className="row">
              <span className="lbl">题注</span>
            </div>
            <input
              className="text-input"
              type="text"
              maxLength={40}
              placeholder="写在下方留白里，可留空"
              value={s.caption}
              onChange={(e) => update('caption', e.target.value)}
            />
          </div>
        )}
      </Section>

      <Section title="水印">
        {logoUrl ? (
          <>
            <div className="logo-bar">
              <div className="logo-chip">
                <img src={logoUrl} alt="logo" />
              </div>
              <span className="logo-name">{POS_LABEL[s.logoPos]} · {s.logoScale}%</span>
              <button type="button" className="btn mini" onClick={onRemoveLogo}>
                移除
              </button>
            </div>
            <div className="field">
              <div className="row">
                <span className="lbl">位置</span>
                <span className="val">{POS_LABEL[s.logoPos]}</span>
              </div>
              <PosGrid value={s.logoPos} onChange={(v) => update('logoPos', v)} />
            </div>
            <Slider
              label="尺寸"
              value={s.logoScale}
              min={3}
              max={40}
              step={1}
              suffix="%"
              onChange={(v) => update('logoScale', v)}
            />
            <Slider
              label="内边距"
              value={s.logoInset}
              min={0}
              max={20}
              step={0.5}
              suffix="%"
              onChange={(v) => update('logoInset', v)}
            />
            <Slider
              label="不透明度"
              value={Math.round(s.logoOpacity * 100)}
              min={10}
              max={100}
              step={1}
              suffix="%"
              onChange={(v) => update('logoOpacity', v / 100)}
            />
          </>
        ) : (
          <>
            <button type="button" className="btn wide" onClick={onPickLogo}>
              上传 Logo
            </button>
            <p className="note">透明底 PNG 最合适。放上去之后可以用九宫格挪位置、调大小和透明度。</p>
          </>
        )}
      </Section>

      {s.style !== 'bleed' && (
        <Section title="照片参数">
          <Toggle
            label="显示在下方留白"
            checked={s.showExif}
            onChange={(v) => update('showExif', v)}
          />
          <div className="field" style={{ marginTop: 12 }}>
            <div className="row">
              <span className="lbl">参数文字</span>
              {exifDetected ? (
                <span className="badge">EXIF</span>
              ) : (
                <span className="val">可手填</span>
              )}
            </div>
            <input
              className="text-input"
              type="text"
              maxLength={90}
              placeholder="35mm · f/1.8 · 1/250s · ISO 400"
              value={s.exifLine}
              onChange={(e) => update('exifLine', e.target.value)}
            />
          </div>
          <p className="note">
            上传 JPEG 会自动读出机身、镜头、焦距、光圈、快门、ISO，拼成一行小字压在底部留白里。
          </p>
        </Section>
      )}

      <Section title="导出">
        <div className="seg">
          {(['png', 'jpeg'] as Format[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`seg-item${s.format === f ? ' on' : ''}`}
              onClick={() => update('format', f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="field">
          <div className="row">
            <span className="lbl">长边</span>
            <span className="val">{s.longEdge} px</span>
          </div>
          <div className="chips">
            {SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip${s.longEdge === n ? ' on' : ''}`}
                onClick={() => update('longEdge', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {s.format === 'jpeg' && (
          <Slider
            label="质量"
            value={Math.round(s.quality * 100)}
            min={50}
            max={100}
            step={1}
            suffix="%"
            onChange={(v) => update('quality', v / 100)}
          />
        )}
        <div className="out-meta">
          {outSize ? `输出 ${outSize.w} × ${outSize.h} px` : '还没有照片'}
        </div>
        <button className="btn primary wide" onClick={onExport} disabled={!count || !!busy}>
          {busy ?? (count > 1 ? '导出当前这张' : '导出图片')}
        </button>
        {count > 1 && (
          <button className="btn wide second" onClick={onExportAll} disabled={!!busy}>
            {busy ? '处理中…' : `导出全部 ${count} 张`}
          </button>
        )}
        <button className="btn ghost wide small" onClick={onReset}>
          恢复默认参数
        </button>
      </Section>
    </aside>
  );
}
