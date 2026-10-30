import { format } from 'd3';

const intFormat = format(',');
const decimalFormat = format(',.2~f');
const compactFormat = format('.3~s');

/** Thousands separators; up to two decimals, trailing zeros trimmed. */
export function defaultNumberFormat(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? intFormat(value) : decimalFormat(value);
}

/** Compact SI format for axis ticks on large values (12k, 3.4M). */
export function defaultTickFormat(value: number): string {
  return Math.abs(value) >= 10_000 ? compactFormat(value).replace('G', 'B') : defaultNumberFormat(value);
}

/** Shortens a label to fit `maxWidth` px (estimated), adding an ellipsis. */
export function truncateLabel(label: string, maxWidth: number, fontSize = 12): string {
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.6)));
  return label.length > maxChars ? `${label.slice(0, Math.max(1, maxChars - 1))}…` : label;
}

export function formatDate(value: Date): string {
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
