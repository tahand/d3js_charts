import { XYChart, type XYChartProps } from './XYChart';

export type LineChartProps = XYChartProps;

/** Single or multi-series line chart — https://observablehq.com/@d3/line-chart/2 */
export function LineChart(props: LineChartProps) {
  return <XYChart {...props} variant="line" />;
}
