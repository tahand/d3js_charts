import { XYChart, type XYChartProps } from './XYChart';

export interface AreaChartProps extends XYChartProps {
  /** Stack series on top of each other instead of overlapping them. */
  stacked?: boolean;
}

/**
 * Area chart, overlapping or stacked —
 * https://observablehq.com/@d3/area-chart/2 and https://observablehq.com/@d3/stacked-area-chart/2
 */
export function AreaChart(props: AreaChartProps) {
  return <XYChart {...props} variant="area" />;
}
