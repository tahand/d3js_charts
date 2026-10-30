import { useEffect, useState, type ReactNode } from 'react';
import {
  AreaChart,
  BarChart,
  ForceGraph,
  GroupedBarChart,
  Heatmap,
  Histogram,
  LineChart,
  PieChart,
  ScatterPlot,
  Sunburst,
  Treemap,
  type CurveType,
  type LegendPosition,
  type TreemapTile,
  type XYSeries,
} from 'd3js-charts';
import * as data from './data';

type ThemeMode = 'system' | 'light' | 'dark';

function Card({ title, link, controls, children }: { title: string; link?: string; controls?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <header className="card__header">
        <h2>{title}</h2>
        {link && (
          <a href={link} target="_blank" rel="noreferrer">
            d3 example ↗
          </a>
        )}
      </header>
      {controls && <div className="card__controls">{controls}</div>}
      {children}
    </section>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <label className="control">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="control control--toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** A live series that appends a point every second. */
function useStreamingSeries(running: boolean): XYSeries[] {
  const [points, setPoints] = useState(() => Array.from({ length: 30 }, (_, i) => ({ x: i, y: 50 + Math.sin(i / 3) * 20 })));
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const y = Math.max(0, Math.min(100, last.y + (Math.random() - 0.5) * 18));
        return [...prev.slice(1), { x: last.x + 1, y: +y.toFixed(1) }];
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  return [{ key: 'cpu', label: 'CPU %', data: points }];
}

export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [animate, setAnimate] = useState(true);
  const [legendPosition, setLegendPosition] = useState<LegendPosition>('bottom');
  const [version, setVersion] = useState(0);

  const [bars, setBars] = useState(() => data.letterFrequency());
  const [barOrientation, setBarOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [barSort, setBarSort] = useState<'none' | 'ascending' | 'descending'>('none');
  const [groups, setGroups] = useState(data.populationByAge);
  const [groupMode, setGroupMode] = useState<'grouped' | 'stacked'>('grouped');
  const [monthly, setMonthly] = useState(data.monthlySeries);
  const [curve, setCurve] = useState<CurveType>('monotone');
  const [stackedArea, setStackedArea] = useState(true);
  const [share, setShare] = useState(data.marketShare);
  const [donut, setDonut] = useState(true);
  const [bubbles, setBubbles] = useState(false);
  const [scatter, setScatter] = useState(() => data.scatterSeries(false));
  const [sample, setSample] = useState(() => data.normalSample());
  const [bins, setBins] = useState('20');
  const [activity, setActivity] = useState(data.weeklyActivity);
  const [budget, setBudget] = useState(data.budget);
  const [tile, setTile] = useState<TreemapTile>('squarify');
  const [graph, setGraph] = useState(data.network);
  const [streaming, setStreaming] = useState(true);
  const stream = useStreamingSeries(streaming);
  const [clicked, setClicked] = useState<string>('—');

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  useEffect(() => setScatter(data.scatterSeries(bubbles)), [bubbles]);

  const shuffleAll = () => {
    setBars(data.letterFrequency(5 + Math.floor(data.rand() * 6)));
    setGroups(data.populationByAge());
    setMonthly(data.monthlySeries());
    setShare(data.marketShare());
    setScatter(data.scatterSeries(bubbles));
    setSample(data.normalSample());
    setActivity(data.weeklyActivity());
    setBudget(data.budget());
    setGraph(data.network());
    setVersion((v) => v + 1);
  };

  // Shared props every chart accepts.
  const common = { animation: animate, legend: { position: legendPosition } };

  return (
    <main className="page">
      <header className="page__header">
        <div>
          <h1>d3js-charts</h1>
          <p>Responsive, animated D3 charts for React. Resize the window, tap marks, and click legend items to toggle series.</p>
        </div>
        <div className="toolbar">
          <Select label="Theme" value={themeMode} options={['system', 'light', 'dark'] as const} onChange={setThemeMode} />
          <Select label="Legend" value={legendPosition} options={['bottom', 'top', 'right', 'left'] as const} onChange={setLegendPosition} />
          <Toggle label="Animate" checked={animate} onChange={setAnimate} />
          <button type="button" className="button" onClick={shuffleAll}>
            Shuffle all data
          </button>
        </div>
      </header>

      <div className="grid">
        <Card
          title="Bar chart"
          link="https://observablehq.com/@d3/bar-chart/2"
          controls={
            <>
              <Select label="Orientation" value={barOrientation} options={['vertical', 'horizontal'] as const} onChange={setBarOrientation} />
              <Select label="Sort" value={barSort} options={['none', 'ascending', 'descending'] as const} onChange={setBarSort} />
              <button type="button" className="button button--small" onClick={() => setBars(data.letterFrequency(5 + Math.floor(data.rand() * 7)))}>
                New data
              </button>
            </>
          }
        >
          <BarChart
            {...common}
            data={bars}
            orientation={barOrientation}
            sort={barSort}
            showValues
            seriesLabel="Frequency"
            valueAxis={{ label: 'Frequency' }}
            onBarClick={(d) => setClicked(`${d.label}: ${d.value}`)}
          />
          <p className="hint">Last clicked bar: {clicked}</p>
        </Card>

        <Card
          title={groupMode === 'stacked' ? 'Stacked bar chart' : 'Grouped bar chart'}
          link={groupMode === 'stacked' ? 'https://observablehq.com/@d3/stacked-bar-chart/2' : 'https://observablehq.com/@d3/grouped-bar-chart/2'}
          controls={<Select label="Mode" value={groupMode} options={['grouped', 'stacked'] as const} onChange={setGroupMode} />}
        >
          <GroupedBarChart {...common} data={groups} categoryKey="state" mode={groupMode} valueAxis={{ label: 'Population (k)' }} />
        </Card>

        <Card
          title="Line chart"
          link="https://observablehq.com/@d3/multi-line-chart/2"
          controls={<Select label="Curve" value={curve} options={['monotone', 'linear', 'step', 'natural', 'basis', 'cardinal'] as const} onChange={setCurve} />}
        >
          <LineChart {...common} series={monthly} curve={curve} showPoints yAxis={{ label: 'Sign-ups' }} />
        </Card>

        <Card
          title={stackedArea ? 'Stacked area chart' : 'Area chart'}
          link="https://observablehq.com/@d3/stacked-area-chart/2"
          controls={<Toggle label="Stacked" checked={stackedArea} onChange={setStackedArea} />}
        >
          <AreaChart {...common} series={monthly} stacked={stackedArea} />
        </Card>

        <Card
          title={donut ? 'Donut chart' : 'Pie chart'}
          link="https://observablehq.com/@d3/donut-chart/2"
          controls={<Toggle label="Donut" checked={donut} onChange={setDonut} />}
        >
          <PieChart
            {...common}
            data={share}
            innerRadius={donut ? 0.6 : 0}
            legend={{ position: legendPosition === 'bottom' ? 'right' : legendPosition }}
          />
        </Card>

        <Card
          title={bubbles ? 'Bubble chart' : 'Scatterplot'}
          link="https://observablehq.com/@d3/scatterplot/2"
          controls={<Toggle label="Size by value (bubbles)" checked={bubbles} onChange={setBubbles} />}
        >
          <ScatterPlot {...common} series={scatter} xAxis={{ label: 'Speed', grid: true }} yAxis={{ label: 'Accuracy' }} sizeLabel="Weight" />
        </Card>

        <Card
          title="Histogram"
          link="https://observablehq.com/@d3/histogram/2"
          controls={
            <>
              <Select label="Bins" value={bins} options={['5', '10', '20', '40'] as const} onChange={setBins} />
              <button type="button" className="button button--small" onClick={() => setSample(data.normalSample())}>
                Resample
              </button>
            </>
          }
        >
          <Histogram {...common} data={sample} thresholds={Number(bins)} seriesLabel="People" xAxis={{ label: 'Score' }} />
        </Card>

        <Card title="Heatmap" link="https://observablehq.com/@d3/heatmap">
          <Heatmap {...common} data={activity} showValues valueLabel="Visits per hour" />
        </Card>

        <Card
          title="Treemap"
          link="https://observablehq.com/@d3/treemap/2"
          controls={<Select label="Tiling" value={tile} options={['squarify', 'binary', 'slice', 'dice', 'sliceDice'] as const} onChange={setTile} />}
        >
          <Treemap {...common} data={budget} tile={tile} valueFormat={(v) => `$${v}k`} />
        </Card>

        <Card title="Sunburst" link="https://observablehq.com/@d3/sunburst/2">
          <Sunburst {...common} data={budget} valueFormat={(v) => `$${v}k`} />
        </Card>

        <Card title="Force-directed graph" link="https://observablehq.com/@d3/force-directed-graph/2">
          <ForceGraph {...common} key={version} nodes={graph.nodes} links={graph.links} />
          <p className="hint">Drag nodes with a mouse or finger.</p>
        </Card>

        <Card title="Live data" controls={<Toggle label="Streaming" checked={streaming} onChange={setStreaming} />}>
          <AreaChart {...common} series={stream} curve="monotone" yAxis={{ min: 0, max: 100, label: 'CPU %' }} animation={animate ? { duration: 400 } : false} />
        </Card>

        <Card title="CSS & theme control">
          <BarChart
            {...common}
            className="custom-chart"
            data={bars.slice(0, 6)}
            colors={['#7c3aed']}
            cornerRadius={10}
            theme={{ fontFamily: 'Georgia, serif', gridColor: 'transparent', axisColor: '#a78bfa' }}
            animation={animate ? { duration: 1200, stagger: 80 } : false}
          />
          <p className="hint">
            <code>colors</code>, <code>theme</code>, <code>className</code> and the <code>.d3c-*</code> class names restyle any chart.
          </p>
        </Card>
      </div>
    </main>
  );
}
