import type { CSSProperties, ReactNode } from 'react';
import { POS9, POS_LABEL, type Pos9, type StyleId } from '../types';

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="row">
        <span className="lbl">{label}</span>
        <span className="val">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip${o.id === value ? ' on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const list = ['#fbfaf7', '#f4f1ea', '#efe6d4', '#e4dbcb', '#1b1d21', '#2b3440'];
  return (
    <div className="swatches">
      {list.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          className={`sw${value.toLowerCase() === c ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="sw custom" title="自定义颜色">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="row toggle-row">
      <span className="lbl">{label}</span>
      <button
        type="button"
        className={`toggle${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <i />
      </button>
    </div>
  );
}

export function Thumb({ id }: { id: StyleId }) {
  return (
    <span className={`th th-${id}`}>
      <span />
    </span>
  );
}

export function PosGrid({
  value,
  onChange,
}: {
  value: Pos9;
  onChange: (v: Pos9) => void;
}) {
  return (
    <div className="posgrid">
      {POS9.map((id) => (
        <button
          key={id}
          type="button"
          title={POS_LABEL[id]}
          aria-label={POS_LABEL[id]}
          className={`pos${value === id ? ' on' : ''}`}
          onClick={() => onChange(id)}
        />
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sec">
      <h3 className="sec-title">{title}</h3>
      {children}
    </section>
  );
}
