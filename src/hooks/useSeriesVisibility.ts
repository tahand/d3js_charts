import { useCallback, useState } from 'react';

/**
 * Tracks which series the user has toggled off via the legend. The last
 * visible series can't be hidden, so the chart never goes blank.
 */
export function useSeriesVisibility(keys: readonly string[], onChange?: (hidden: string[]) => void) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback(
    (key: string) => {
      const next = new Set(hidden);
      if (next.has(key)) {
        next.delete(key);
      } else {
        const visible = keys.filter((k) => !next.has(k));
        if (visible.length <= 1 && visible[0] === key) return;
        next.add(key);
      }
      setHidden(next);
      onChange?.([...next]);
    },
    [hidden, keys, onChange],
  );

  const isVisible = useCallback((key: string) => !hidden.has(key), [hidden]);

  return { hidden, toggle, isVisible };
}
