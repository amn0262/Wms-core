import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  Radio,
  Minimize2,
  Layers,
  Truck,
} from 'lucide-react';
import type { Customer, Transaction } from '../types';

export interface TickerItem {
  text: string;
  positive: boolean;
  tag: string;
}

interface LiveExchangeTerminalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  transactions: Transaction[];
  tickerItems: TickerItem[];
}

export const LiveExchangeTerminal: React.FC<LiveExchangeTerminalProps> = ({
  isOpen,
  onClose,
  customers,
  transactions,
  tickerItems,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [tickCount, setTickCount] = useState(0);

  // Dynamic live wave data for the stock exchange chart
  const [dynamicWaveData, setDynamicWaveData] = useState<{
    revPoints: number[];
    costPoints: number[];
    volumeBars: number[];
    labels: string[];
  }>({
    revPoints: [42, 48, 55, 50, 62, 58, 68, 75, 72, 85, 80, 92, 88, 96, 91, 102],
    costPoints: [22, 28, 25, 32, 29, 35, 31, 38, 36, 42, 40, 45, 43, 48, 44, 49],
    volumeBars: [60, 45, 80, 55, 90, 70, 85, 65, 95, 75, 85, 60, 95, 80, 90, 100],
    labels: ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45'],
  });

  // Calculate baseline real stats
  const { totalRevenue, totalCosts, marginPercent } = useMemo(() => {
    let rev = 0;
    let costs = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Income') {
        rev += amt;
      } else {
        costs += amt;
      }
    });
    return {
      totalRevenue: rev,
      totalCosts: costs,
      marginPercent: rev > 0 ? ((rev - costs) / rev) * 100 : 0,
    };
  }, [transactions]);

  // Handle Fullscreen API & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const elem = document.documentElement;
    if (elem.requestFullscreen && !document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Real-time trading floor timer & dynamic chart fluctuations
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('de-DE', { hour12: false }) +
          '.' +
          String(Math.floor(now.getMilliseconds() / 100))
      );
      setTickCount((prev) => prev + 1);

      // Periodically evolve chart curves with micro-market movement
      setDynamicWaveData((prev) => {
        const lastRev = prev.revPoints[prev.revPoints.length - 1];
        const lastCost = prev.costPoints[prev.costPoints.length - 1];

        const revDelta = (Math.random() - 0.46) * 4.2;
        const costDelta = (Math.random() - 0.48) * 2.1;

        const newRev = Math.max(35, Math.min(115, lastRev + revDelta));
        const newCost = Math.max(18, Math.min(65, lastCost + costDelta));
        const newVol = Math.floor(Math.random() * 60) + 40;

        const timeStr = now.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        return {
          revPoints: [...prev.revPoints.slice(1), parseFloat(newRev.toFixed(1))],
          costPoints: [...prev.costPoints.slice(1), parseFloat(newCost.toFixed(1))],
          volumeBars: [...prev.volumeBars.slice(1), newVol],
          labels: [...prev.labels.slice(1), timeStr],
        };
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Chart SVG Geometry Math
  const width = 1000;
  const height = 340;
  const paddingLeft = 35;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const maxVal = 120;

  const count = dynamicWaveData.revPoints.length;
  const revPointsCoords = dynamicWaveData.revPoints.map((val, idx) => {
    const x = paddingLeft + (idx / (count - 1)) * chartW;
    const y = paddingTop + (1 - val / maxVal) * chartH;
    return { x, y, val };
  });

  const costPointsCoords = dynamicWaveData.costPoints.map((val, idx) => {
    const x = paddingLeft + (idx / (count - 1)) * chartW;
    const y = paddingTop + (1 - val / maxVal) * chartH;
    return { x, y, val };
  });

  const revPath = revPointsCoords.reduce(
    (acc, p, i, a) =>
      i === 0
        ? `M ${p.x},${p.y}`
        : `${acc} Q ${(a[i - 1].x + p.x) / 2},${a[i - 1].y} ${p.x},${p.y}`,
    ''
  );

  const costPath = costPointsCoords.reduce(
    (acc, p, i, a) =>
      i === 0
        ? `M ${p.x},${p.y}`
        : `${acc} Q ${(a[i - 1].x + p.x) / 2},${a[i - 1].y} ${p.x},${p.y}`,
    ''
  );

  const revArea = `${revPath} L ${revPointsCoords[count - 1].x},${height - paddingBottom} L ${revPointsCoords[0].x},${height - paddingBottom} Z`;

  // Latest real-time coordinates
  const latestRev = revPointsCoords[count - 1];
  const latestCost = costPointsCoords[count - 1];

  // Dynamic fluctuation delta for visual live flash
  const liveRevFluctuation = (tickCount % 2 === 0 ? 1 : -1) * ((tickCount * 7) % 25);
  const displayRevenue = totalRevenue + liveRevFluctuation;

  const handleExit = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#05070a] text-slate-100 flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* ======================================================== */}
      {/* 1. TOP LIVE TICKER MARQUEE (SYNCHRONIZED LIVE FEED)      */}
      {/* ======================================================== */}
      <div className="shrink-0 bg-[#080b10] border-b border-slate-800/80 flex items-center justify-between z-20 overflow-hidden">
        {/* Lead-in indicator */}
        <div className="shrink-0 z-20 flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border-r border-slate-800 text-xs font-mono font-semibold tracking-wider text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-white hidden sm:inline">LIVE FEED</span>
          <span className="text-slate-500 text-[11px] tabular-nums font-mono">
            {currentTime}
          </span>
        </div>

        {/* Marquee Streaming Strip - Identical to Home Page */}
        <div className="overflow-hidden flex-1 py-2">
          <div className="animate-ticker text-xs font-mono tabular-nums whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 mx-4 text-slate-300 select-none"
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                  {item.tag}
                </span>
                <span className="font-medium text-slate-200">{item.text}</span>
                <span
                  className={`font-bold ${
                    item.positive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {item.positive ? '▲' : '▼'}
                </span>
                <span className="text-slate-700 ml-2">/</span>
              </div>
            ))}
          </div>
        </div>

        {/* Discrete Exit button (No menus or clutter) */}
        <div className="shrink-0 z-20 px-3 py-1.5 bg-slate-900 border-l border-slate-800 flex items-center gap-2">
          <button
            onClick={handleExit}
            className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exit Fullscreen (ESC)"
          >
            <span className="text-[10px] text-slate-500">ESC</span>
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN COCKPIT: DYNAMIC FINANCIAL GRAPH & TELEMETRY     */}
      {/* ======================================================== */}
      <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 min-h-0 overflow-hidden">
        {/* Left 3 Columns: High-Frequency Chart & Candlestick Volume */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-[#080b10] border border-slate-800/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          {/* Chart Header Metrics Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
                <span>INDEX: WMS/EUR REALTIME LEDGER</span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400 font-bold">HIGH FREQUENCY</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white tabular-nums">
                  €{displayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{marginPercent.toFixed(1)}%</span>
                </span>
                <span className="text-xs font-mono text-slate-500 hidden sm:inline">
                  (LAST TICK DELTA: +€{((tickCount * 13) % 48).toFixed(2)})
                </span>
              </div>
            </div>

            {/* Live Chart Legend */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                <span className="text-slate-300 font-semibold">REVENUE STREAM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-rose-500 rounded-full shadow-[0_0_8px_#f43f5e]" />
                <span className="text-slate-300 font-semibold">LOGISTICS COST</span>
              </div>
            </div>
          </div>

          {/* Real-Time SVG Animated Financial Curve */}
          <div className="flex-1 w-full flex items-center justify-center my-2 relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full max-h-[360px] overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="liveRevGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="costGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((frac, idx) => {
                const y = paddingTop + (1 - frac) * chartH;
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="#151c28"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={width - paddingRight + 6}
                      y={y + 3}
                      fill="#475569"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      €{Math.round(maxVal * frac * 120)}
                    </text>
                  </g>
                );
              })}

              {/* Volume Bars at bottom */}
              {dynamicWaveData.volumeBars.map((vol, vIdx) => {
                const barW = (chartW / count) * 0.55;
                const barX = paddingLeft + (vIdx / (count - 1)) * chartW - barW / 2;
                const barH = (vol / 100) * 45;
                const barY = height - paddingBottom - barH;
                const isGreen = vIdx % 2 === 0;
                return (
                  <rect
                    key={vIdx}
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    fill={isGreen ? '#10b981' : '#f43f5e'}
                    opacity={0.22}
                    rx="1"
                  />
                );
              })}

              {/* Area Fill for Revenue */}
              <path d={revArea} fill="url(#liveRevGlow)" />

              {/* Cost Stream Line */}
              <path
                d={costPath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />

              {/* Revenue Stream Line */}
              <path
                d={revPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]"
              />

              {/* Vertical Crosshair Line tracking latest coordinate */}
              <line
                x1={latestRev.x}
                y1={paddingTop}
                x2={latestRev.x}
                y2={height - paddingBottom}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity={0.5}
              />

              {/* Latest Live Point Pulsing Beacon for Revenue */}
              <circle
                cx={latestRev.x}
                cy={latestRev.y}
                r="6"
                fill="#10b981"
                className="animate-ping opacity-75"
              />
              <circle
                cx={latestRev.x}
                cy={latestRev.y}
                r="5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* Latest Live Point for Costs */}
              <circle
                cx={latestCost.x}
                cy={latestCost.y}
                r="4"
                fill="#f43f5e"
                stroke="#ffffff"
                strokeWidth="1.5"
              />

              {/* Bottom Time Axis Labels */}
              {dynamicWaveData.labels.map((lbl, lIdx) => {
                if (lIdx % 2 !== 0 && lIdx !== count - 1) return null;
                const x = paddingLeft + (lIdx / (count - 1)) * chartW;
                return (
                  <text
                    key={lIdx}
                    x={x}
                    y={height - paddingBottom + 18}
                    fill="#64748b"
                    fontSize="9.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {lbl}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Under-Chart Telemetry Strip */}
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">LIVE SPREAD</span>
              <span className="text-emerald-400 font-bold text-sm">
                +€{(displayRevenue - totalCosts).toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">DAILY VELOCITY</span>
              <span className="text-white font-bold text-sm">
                4.8 ORDERS/HR
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">FULFILLMENT RATE</span>
              <span className="text-emerald-400 font-bold text-sm">
                99.4% NOMINAL
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">VOLATILITY INDEX</span>
              <span className="text-sky-400 font-bold text-sm">
                LOW (0.12 VOL)
              </span>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Stock Order Book & High-Bay Warehouse Matrix */}
        <div className="space-y-4 flex flex-col justify-between overflow-hidden">
          {/* Streaming Order Book */}
          <div className="flex-1 bg-[#080b10] border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono mb-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span>ORDER TAPE STREAM</span>
              </div>
              <span className="text-slate-500 text-[10px]">REAL-TIME</span>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1 text-xs font-mono">
              {transactions.slice(0, 7).map((t, idx) => {
                const isInc = t.type === 'Income';
                return (
                  <div
                    key={t.id || idx}
                    className="p-2 rounded bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-slate-200 font-medium truncate max-w-[150px]">
                        {t.description}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {t.date} · {t.category}
                      </div>
                    </div>
                    <div
                      className={`font-bold tabular-nums text-right ${
                        isInc ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isInc ? '+' : '-'}€{Number(t.amount).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Bay Pallet Matrix Box */}
          <div className="bg-[#080b10] border border-slate-800/80 rounded-2xl p-4 shadow-xl text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>WAREHOUSE BAYS LOAD</span>
              </div>
              <span className="text-emerald-400 font-bold">78%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400">Bay A1 (Pallets)</div>
                <div className="text-emerald-400 font-bold mt-0.5">88% Capacity</div>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400">Bay B2 (Apparel)</div>
                <div className="text-sky-400 font-bold mt-0.5">74% Capacity</div>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400">Bay C1 (Pack)</div>
                <div className="text-amber-400 font-bold mt-0.5">62% Capacity</div>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400">Bay D4 (Staging)</div>
                <div className="text-rose-400 font-bold mt-0.5">92% Capacity</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. BOTTOM CARRIER STATUS BAR                             */}
      {/* ======================================================== */}
      <div className="shrink-0 bg-[#080b10] border-t border-slate-800/80 px-4 py-2 flex items-center justify-between z-20 text-xs font-mono">
        <div className="flex items-center gap-3">
          <Truck className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-slate-400 hidden sm:inline">CARRIER DISPATCH:</span>
          <span className="text-emerald-400 font-bold">DHL FREIGHT [ONLINE]</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-bold">DPD EXPRESS [ACTIVE]</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-bold">UPS CROSS-BORDER [ACTIVE]</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span className="text-slate-500 font-bold">PRESS ESC TO RETURN</span>
        </div>
      </div>
    </div>
  );
};
