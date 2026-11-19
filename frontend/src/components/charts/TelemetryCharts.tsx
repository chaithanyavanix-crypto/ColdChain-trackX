import React, { useState } from 'react';
import { TempReadingPoint } from '../../types/coldchain';

/* 1. 24h Temperature Area/Line Chart with Safe Band */
export const Temperature24hChart: React.FC<{
  data: TempReadingPoint[];
  safeMin: number;
  safeMax: number;
  height?: number;
}> = ({ data, safeMin, safeMax, height = 210 }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 560;
  const h = height;
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 26;

  const temps = data.map((d) => d.tempC);
  const minVal = Math.min(...temps, safeMin) - 1.5;
  const maxVal = Math.max(...temps, safeMax) + 1.5;
  const span = Math.max(1, maxVal - minVal);

  const getX = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR);
  const getY = (val: number) => padT + ((maxVal - val) / span) * (h - padT - padB);

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.tempC).toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${getX(data.length - 1).toFixed(1)} ${h - padB} L ${getX(0).toFixed(1)} ${
    h - padB
  } Z`;

  const safeTopY = getY(safeMax);
  const safeBottomY = getY(safeMin);

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Safe Corridor Band */}
        <rect
          x={padL}
          y={Math.max(padT, safeTopY)}
          width={w - padL - padR}
          height={Math.max(4, Math.min(h - padB, safeBottomY) - Math.max(padT, safeTopY))}
          fill="rgba(16, 185, 129, 0.08)"
        />
        <line
          x1={padL}
          x2={w - padR}
          y1={safeTopY}
          y2={safeTopY}
          stroke="rgba(245, 158, 11, 0.45)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <line
          x1={padL}
          x2={w - padR}
          y1={safeBottomY}
          y2={safeBottomY}
          stroke="rgba(56, 189, 248, 0.35)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = maxVal - t * span;
          const y = padT + t * (h - padT - padB);
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.1)" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
                {val.toFixed(0)}°
              </text>
            </g>
          );
        })}

        {/* Area & Line */}
        <path d={areaD} fill="url(#tempAreaGrad)" />
        <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinejoin="round" />

        {/* X Axis labels */}
        {data.map((d, i) =>
          i % 4 === 0 || i === data.length - 1 ? (
            <text
              key={d.label + i}
              x={getX(i)}
              y={h - 6}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-mono"
            >
              {d.label}
            </text>
          ) : null
        )}

        {/* Interactive hover points */}
        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.tempC);
          const isBreach = d.tempC > safeMax || d.tempC < safeMin;
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
              <rect x={cx - 10} y={padT} width={20} height={h - padT - padB} fill="transparent" />
              {(hoverIdx === i || isBreach) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={hoverIdx === i ? 4.5 : 3}
                  fill={isBreach ? '#ef4444' : '#38bdf8'}
                  stroke="#0b0f17"
                  strokeWidth="1.5"
                />
              )}
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <div className="mt-1 flex items-center justify-between rounded border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
          <span className="font-mono text-slate-400">UTC {data[hoverIdx].label}</span>
          <span className="font-mono font-semibold text-sky-400">
            Cargo: {data[hoverIdx].tempC.toFixed(2)}°C
          </span>
          <span className="font-mono text-slate-400">Ambient: {data[hoverIdx].ambientC}°C</span>
        </div>
      )}
    </div>
  );
};

/* 2. AI Temperature Prediction Chart (Actual + +15m/+30m/+1h Forecast) */
export const PredictionChart: React.FC<{
  currentTemp: number;
  pred15m: number;
  pred30m: number;
  pred1h: number;
  safeMax: number;
  height?: number;
}> = ({ currentTemp, pred15m, pred30m, pred1h, safeMax, height = 165 }) => {
  const w = 420;
  const h = height;
  const padL = 38;
  const padR = 16;
  const padT = 16;
  const padB = 26;

  const series = [
    { label: '-30m', val: Number((currentTemp - (pred15m - currentTemp) * 0.6).toFixed(2)), forecast: false },
    { label: '-15m', val: Number((currentTemp - (pred15m - currentTemp) * 0.3).toFixed(2)), forecast: false },
    { label: 'Now', val: currentTemp, forecast: false },
    { label: '+15m', val: pred15m, forecast: true },
    { label: '+30m', val: pred30m, forecast: true },
    { label: '+1h', val: pred1h, forecast: true },
  ];

  const vals = series.map((s) => s.val).concat(safeMax);
  const minVal = Math.min(...vals) - 1.2;
  const maxVal = Math.max(...vals) + 1.2;
  const span = Math.max(1, maxVal - minVal);

  const getX = (i: number) => padL + (i / (series.length - 1)) * (w - padL - padR);
  const getY = (val: number) => padT + ((maxVal - val) / span) * (h - padT - padB);

  const actualD = series
    .slice(0, 3)
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(s.val).toFixed(1)}`)
    .join(' ');
  const forecastD = series
    .slice(2)
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i + 2).toFixed(1)} ${getY(s.val).toFixed(1)}`)
    .join(' ');

  const threshY = getY(safeMax);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full select-none overflow-visible">
      <line
        x1={padL}
        x2={w - padR}
        y1={threshY}
        y2={threshY}
        stroke="rgba(239, 68, 68, 0.55)"
        strokeDasharray="4 4"
      />
      <text x={w - padR} y={threshY - 4} textAnchor="end" className="fill-rose-400 text-[10px] font-mono">
        Max {safeMax}°C
      </text>

      {[0, 0.5, 1].map((t) => {
        const y = padT + t * (h - padT - padB);
        const val = maxVal - t * span;
        return (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.1)" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
              {val.toFixed(1)}°
            </text>
          </g>
        );
      })}

      {/* Confidence cone */}
      <polygon
        points={`${getX(2)},${getY(series[2].val)} ${getX(5)},${getY(series[5].val + 0.6)} ${getX(5)},${getY(
          series[5].val - 0.6
        )}`}
        fill="rgba(56, 189, 248, 0.12)"
      />

      <path d={actualD} fill="none" stroke="#38bdf8" strokeWidth="2.4" />
      <path d={forecastD} fill="none" stroke="#f59e0b" strokeWidth="2.4" strokeDasharray="5 4" />

      {series.map((s, i) => (
        <g key={s.label}>
          <circle
            cx={getX(i)}
            cy={getY(s.val)}
            r={s.label === 'Now' ? 4.5 : 3.5}
            fill={s.forecast ? '#f59e0b' : '#38bdf8'}
            stroke="#0b0f17"
            strokeWidth="1.5"
          />
          <text x={getX(i)} y={h - 6} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

/* 3. Clean Multi-Segment Donut Chart */
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export const DonutChart: React.FC<{
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}> = ({ segments, centerLabel, centerValue, size = 152 }) => {
  const total = Math.max(
    1,
    segments.reduce((acc, s) => acc + s.value, 0)
  );
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="14" />
          {segments.map((seg) => {
            const dash = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-xl font-bold text-slate-100 tabular-nums">{centerValue}</span>
          <span className="text-[11px] text-slate-400">{centerLabel}</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="font-mono font-medium text-slate-100 tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* 4. Temperature Distribution Histogram */
export const DistributionHistogram: React.FC<{
  buckets: { label: string; count: number; color: string }[];
}> = ({ buckets }) => {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="flex h-48 items-end justify-between gap-2 pt-6">
      {buckets.map((b) => {
        const pct = Math.max(6, Math.round((b.count / max) * 100));
        return (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-slate-300 tabular-nums">{b.count}</span>
            <div className="flex h-32 w-full items-end rounded-t bg-slate-900/70 px-1">
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{ height: `${pct}%`, backgroundColor: b.color }}
              />
            </div>
            <span className="text-center font-mono text-[10px] text-slate-400">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/* 5. Dual-Series Trip Analytics Chart (Cargo Temp + Velocity) */
export const DualAxisTripChart: React.FC<{
  points: { timestamp: string; tempC: number; velocityKmh: number }[];
}> = ({ points }) => {
  const w = 620;
  const h = 210;
  const padL = 40;
  const padR = 42;
  const padT = 18;
  const padB = 26;

  const temps = points.map((p) => p.tempC);
  const minT = Math.min(...temps) - 1;
  const maxT = Math.max(...temps) + 1;
  const spanT = Math.max(1, maxT - minT);

  const getX = (i: number) => padL + (i / Math.max(1, points.length - 1)) * (w - padL - padR);
  const getTempY = (t: number) => padT + ((maxT - t) / spanT) * (h - padT - padB);
  const getVelY = (v: number) => padT + ((110 - Math.min(110, v)) / 110) * (h - padT - padB);

  const tempPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getTempY(p.tempC).toFixed(1)}`)
    .join(' ');
  const velPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getVelY(p.velocityKmh).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full select-none overflow-visible">
      {[0, 0.5, 1].map((r) => {
        const y = padT + r * (h - padT - padB);
        const tVal = maxT - r * spanT;
        const vVal = Math.round(110 * (1 - r));
        return (
          <g key={r}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.1)" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-sky-400 text-[10px] font-mono">
              {tVal.toFixed(1)}°
            </text>
            <text x={w - padR + 6} y={y + 3} textAnchor="start" className="fill-emerald-400 text-[10px] font-mono">
              {vVal}km/h
            </text>
          </g>
        );
      })}

      <path d={velPath} fill="none" stroke="rgba(16, 185, 129, 0.6)" strokeWidth="1.8" strokeDasharray="4 3" />
      <path d={tempPath} fill="none" stroke="#38bdf8" strokeWidth="2.4" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getTempY(p.tempC)} r="3.2" fill="#38bdf8" />
          <text x={getX(i)} y={h - 6} textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
            {p.timestamp}
          </text>
        </g>
      ))}
    </svg>
  );
};
