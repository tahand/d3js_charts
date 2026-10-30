import { useMemo } from 'react';
import { useSeriesVisibility } from '../hooks/useSeriesVisibility';
import { useTooltip } from '../hooks/useTooltip';
import type { AnimationOptions, BaseChartProps, ColorInput } from '../types';
import { resolveAnimation } from './animation';
import { createColorScale } from './colors';

/** Animation settings memoised on their values, so inline objects don't force redraws. */
export function useAnimation(input: boolean | AnimationOptions | undefined) {
  const o = typeof input === 'object' ? input : undefined;
  const flag = typeof input === 'boolean' ? input : undefined;
  return useMemo(
    () => resolveAnimation(o ?? flag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flag, o?.enabled, o?.duration, o?.delay, o?.easing, o?.stagger],
  );
}

function colorsKey(colors: ColorInput | undefined) {
  return Array.isArray(colors) ? colors.join('|') : colors;
}

/** State and helpers shared by every chart: tooltip, legend toggling, animation, colours. */
export function useChartBase(
  props: BaseChartProps & { onLegendToggle?: (hidden: string[]) => void },
  keys: readonly string[],
) {
  const keysId = keys.join('\u0000');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableKeys = useMemo(() => keys, [keysId]);
  const tooltipApi = useTooltip(props.tooltip !== false);
  const { hidden, toggle } = useSeriesVisibility(stableKeys, props.onLegendToggle);
  const anim = useAnimation(props.animation);
  const cKey = colorsKey(props.colors);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colorOf = useMemo(() => createColorScale(stableKeys, props.colors), [stableKeys, cKey]);
  return { tooltipApi, hidden, toggle, anim, colorOf, keys: stableKeys };
}
