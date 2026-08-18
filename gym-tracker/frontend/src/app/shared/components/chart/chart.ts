import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { HistoryPoint } from '../../models';
import { formatWeight } from '../../utils';

export type ChartMetric = 'weight' | 'e1rm';

const PAD = { top: 14, right: 12, bottom: 26, left: 40 };

interface Dot {
  i: number;
  x: number;
  y: number;
  value: number;
  isPr: boolean;
  isLast: boolean;
}

interface Segment {
  d: string;
}

interface ChartView {
  w: number;
  h: number;
  dots: Dot[];
  segments: Segment[];
  ticks: { y: number; label: string }[];
  xLabels: [string, string];
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

@Component({
  selector: 'app-chart',
  templateUrl: './chart.html',
  styleUrl: './chart.scss',
})
export class Chart {
  points = input<HistoryPoint[]>([]);
  metric = input<ChartMetric>('weight');
  height = input(190);

  readonly selected = signal<number | null>(null);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private readonly width = signal(320);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host()?.nativeElement;
      if (!el) return;
      const measure = () => this.width.set(el.clientWidth || 320);
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  readonly view = computed<ChartView | null>(() => {
    const pts = this.points();
    const metric = this.metric();
    const w = Math.max(this.width(), 240);
    const h = this.height();
    const iw = w - PAD.left - PAD.right;
    const ih = h - PAD.top - PAD.bottom;

    const data: { p: HistoryPoint; v: number | null }[] = pts.map((p) => ({
      p,
      v: metric === 'weight' ? p.maxWeightKg : p.maxE1rmKg,
    }));

    const nonNull = data.filter((d): d is { p: HistoryPoint; v: number } => d.v !== null);
    if (nonNull.length === 0) return null;

    const values = nonNull.map((d) => d.v);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max === min) {
      max += 1;
      min = Math.max(0, min - 1);
    }
    const span = max - min;
    min -= span * 0.08;
    max += span * 0.08;
    const totalSpan = max - min || 1;

    const xFor = (i: number) =>
      data.length === 1
        ? PAD.left + iw / 2
        : PAD.left + (i / (data.length - 1)) * iw;
    const yFor = (v: number) => PAD.top + (1 - (v - min) / totalSpan) * ih;

    let runningMax = -Infinity;
    const dots: Dot[] = [];
    const segments: Segment[] = [];
    let current: string[] = [];

    data.forEach((d, i) => {
      if (d.v === null) {
        if (current.length > 0) {
          segments.push({ d: current.join(' ') });
          current = [];
        }
        return;
      }
      const x = xFor(i);
      const y = yFor(d.v);
      const isPr = d.v > runningMax;
      runningMax = Math.max(runningMax, d.v);
      dots.push({ i, x, y, value: d.v, isPr, isLast: i === data.length - 1 });
      current.push(`${current.length === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    });
    if (current.length > 0) {
      segments.push({ d: current.join(' ') });
    }

    const ticks = [min, (min + max) / 2, max].map((v) => ({
      y: yFor(v),
      label: formatWeight(Math.round(v * 10) / 10),
    }));

    const first = pts[0]?.date;
    const last = pts[pts.length - 1]?.date;
    if (!first || !last) return null;

    return { w, h, dots, segments, ticks, xLabels: [first, last] };
  });

  readonly selectedDot = computed(() => {
    const v = this.view();
    const idx = this.selected();
    if (!v || idx === null) return null;
    const dot = v.dots.find((d) => d.i === idx);
    if (!dot) return null;
    const point = this.points()[idx];
    if (!point) return null;
    const leftPct = Math.min(88, Math.max(12, (dot.x / v.w) * 100));
    const topPct = (dot.y / v.h) * 100;
    return {
      leftPct,
      topPct,
      date: shortDate(point.date),
      value: formatWeight(dot.value),
      setsCount: point.setsCount,
    };
  });

  protected readonly PAD = PAD;
  protected readonly shortDate = shortDate;

  onMove(event: PointerEvent): void {
    const el = this.host()?.nativeElement;
    const v = this.view();
    if (!el || !v) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let nearest = -1;
    let best = Infinity;
    for (const dot of v.dots) {
      const dist = Math.abs(dot.x - x);
      if (dist < best) {
        best = dist;
        nearest = dot.i;
      }
    }
    this.selected.set(nearest >= 0 ? nearest : null);
  }

  clearSelected(): void {
    this.selected.set(null);
  }
}
