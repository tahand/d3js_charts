import type { GraphLink, GraphNode, HeatmapDatum, HierarchyDatum, MultiBarDatum, ScatterSeries, XYSeries } from 'd3js-charts';

/** Small seeded RNG so "shuffle" produces varied but reproducible-looking data. */
let seed = 7;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));

const LETTERS = 'ABCDEFGHIJKL'.split('');
export function letterFrequency(count = 8) {
  return LETTERS.slice(0, count).map((label) => ({ label, value: between(5, 100) }));
}

const STATES = ['California', 'Texas', 'Florida', 'New York', 'Ohio'];
export function populationByAge(): MultiBarDatum[] {
  return STATES.map((state) => ({
    state,
    'Under 18': between(10, 40),
    '18–64': between(30, 90),
    '65+': between(5, 30),
  }));
}

export function monthlySeries(): XYSeries[] {
  const months = Array.from({ length: 12 }, (_, i) => new Date(2025, i, 1));
  const walk = (start: number, vol: number) => {
    let v = start;
    return months.map((x) => {
      v = Math.max(0, v + (rand() - 0.45) * vol);
      return { x, y: Math.round(v) };
    });
  };
  return [
    { key: 'web', label: 'Web', data: walk(120, 30) },
    { key: 'ios', label: 'iOS', data: walk(80, 25) },
    { key: 'android', label: 'Android', data: walk(60, 25) },
  ];
}

export function marketShare() {
  return [
    { label: 'Chrome', value: between(50, 70) },
    { label: 'Safari', value: between(15, 25) },
    { label: 'Edge', value: between(4, 10) },
    { label: 'Firefox', value: between(2, 8) },
    { label: 'Other', value: between(2, 6) },
  ];
}

export function scatterSeries(bubbles = false): ScatterSeries[] {
  const make = (cx: number, cy: number) =>
    Array.from({ length: 18 }, (_, i) => ({
      x: +(cx + (rand() - 0.5) * 30).toFixed(1),
      y: +(cy + (rand() - 0.5) * 30).toFixed(1),
      size: bubbles ? between(1, 100) : undefined,
      label: `#${i + 1}`,
    }));
  return [
    { key: 'a', label: 'Cluster A', data: make(30, 40) },
    { key: 'b', label: 'Cluster B', data: make(60, 70) },
    { key: 'c', label: 'Cluster C', data: make(75, 30) },
  ];
}

/** Roughly normal values via the sum of uniforms. */
export function normalSample(n = 400, mean = 50, spread = 12) {
  return Array.from({ length: n }, () => {
    let s = 0;
    for (let i = 0; i < 6; i++) s += rand();
    return +(mean + (s - 3) * spread).toFixed(2);
  });
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p'];
export function weeklyActivity(): HeatmapDatum[] {
  return DAYS.flatMap((y, di) =>
    HOURS.map((x, hi) => ({ x, y, value: Math.round((di < 5 ? 40 : 15) + Math.sin(hi / 2) * 25 + rand() * 30) })),
  );
}

export function budget(): HierarchyDatum {
  const leaf = (name: string, lo: number, hi: number) => ({ name, value: between(lo, hi) });
  return {
    name: 'Budget',
    children: [
      { name: 'Engineering', children: [leaf('Platform', 20, 60), leaf('Mobile', 15, 40), leaf('Web', 15, 45), leaf('Data', 10, 30)] },
      { name: 'Sales', children: [leaf('Enterprise', 20, 50), leaf('SMB', 10, 30), leaf('Partners', 5, 15)] },
      { name: 'Marketing', children: [leaf('Brand', 10, 25), leaf('Events', 5, 20), leaf('Content', 5, 15)] },
      { name: 'Operations', children: [leaf('Facilities', 8, 20), leaf('IT', 6, 18), leaf('Legal', 4, 12)] },
    ],
  };
}

export function network(): { nodes: GraphNode[]; links: GraphLink[] } {
  const groups = ['Design', 'Engineering', 'Product'];
  const nodes: GraphNode[] = Array.from({ length: 30 }, (_, i) => ({
    id: `n${i}`,
    label: `Person ${i + 1}`,
    group: groups[i % 3],
    size: between(1, 10),
  }));
  const links: GraphLink[] = [];
  for (let i = 1; i < nodes.length; i++) {
    // Mostly link within a group, sometimes across.
    const sameGroup = nodes.filter((n, j) => j < i && n.group === nodes[i].group);
    const pool = rand() < 0.8 && sameGroup.length ? sameGroup : nodes.slice(0, i);
    links.push({ source: nodes[i].id, target: pool[Math.floor(rand() * pool.length)].id, value: between(1, 5) });
  }
  return { nodes, links };
}
