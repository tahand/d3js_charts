import type { ReactNode } from 'react';

export interface TooltipRow {
  label: ReactNode;
  value: ReactNode;
  color?: string;
}

/** Default tooltip body: an optional heading and label/value rows. */
export function TooltipContent({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <>
      {title != null && <div className="d3c-tooltip__title">{title}</div>}
      {rows.map((row, i) => (
        <div className="d3c-tooltip__row" key={i}>
          {row.color && <span className="d3c-tooltip__swatch" style={{ background: row.color }} />}
          <span className="d3c-tooltip__label">{row.label}</span>
          <span className="d3c-tooltip__value">{row.value}</span>
        </div>
      ))}
    </>
  );
}
