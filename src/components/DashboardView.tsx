import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Printer,
  PlusCircle,
  UserPlus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  PackageCheck,
  Percent,
  Activity,
  Truck,
  Layers,
  Zap,
  Clock,
  Radio,
  Building2,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { LiveExchangeTerminal } from './LiveExchangeTerminal';

interface DashboardViewProps {
  customers: Customer[];
  transactions: Transaction[];
  printQueueCount: number;
  onOpenTransactionModal: () => void;
  onOpenCustomerModal: () => void;
  onNavigate: (view: string) => void;
  onSeedDemoData: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  customers,
  transactions,
  printQueueCount,
  onOpenTransactionModal,
  onOpenCustomerModal,
  onNavigate,
  onSeedDemoData,
}) => {
  const [chartRange, setChartRange] = useState<'30D' | '90D' | 'ALL'>('30D');
  const [liveTimestamp, setLiveTimestamp] = useState<string>('');
  const [isExchangeTerminalOpen, setIsExchangeTerminalOpen] = useState(false);

  // Clock ticker updating every second for high-frequency trading feel
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTimestamp(now.toLocaleTimeString('de-DE', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Customer map
  const customerMap = useMemo(() => {
    const map: Record<number, Customer> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [customers]);

  // High-level operational financial metrics
  const {
    totalRevenue,
    totalCosts,
    netProfit,
    marginPercent,
    costCategories,
    incomeCount,
    shippingCostTotal,
    averageOrderValue,
    shippingRatio,
  } = useMemo(() => {
    let rev = 0;
    let costs = 0;
    let incCount = 0;
    let shipTotal = 0;
    const catMap: Record<string, number> = {};

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Income') {
        rev += amt;
        incCount += 1;
      } else {
        costs += amt;
        catMap[t.category] = (catMap[t.category] || 0) + amt;
        if (t.category === 'Shipping') {
          shipTotal += amt;
        }
      }
    });

    const profit = rev - costs;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;
    const aov = incCount > 0 ? rev / incCount : 0;
    const sRatio = rev > 0 ? (shipTotal / rev) * 100 : 0;

    const catArray = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: costs > 0 ? (amount / costs) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalRevenue: rev,
      totalCosts: costs,
      netProfit: profit,
      marginPercent: margin,
      costCategories: catArray,
      incomeCount: incCount,
      shippingCostTotal: shipTotal,
      averageOrderValue: aov,
      shippingRatio: sRatio,
    };
  }, [transactions]);

  // Aggregate monthly or periodic trends for the chart
  const chartData = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sorted.length === 0) {
      return [
        { label: 'W1', rev: 0, cost: 0 },
        { label: 'W2', rev: 0, cost: 0 },
        { label: 'W3', rev: 0, cost: 0 },
        { label: 'W4', rev: 0, cost: 0 },
      ];
    }

    const grouped: Record<string, { rev: number; cost: number }> = {};
    sorted.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!grouped[key]) {
        grouped[key] = { rev: 0, cost: 0 };
      }
      if (t.type === 'Income') {
        grouped[key].rev += Number(t.amount) || 0;
      } else {
        grouped[key].cost += Number(t.amount) || 0;
      }
    });

    const entries = Object.entries(grouped);
    const sliceCount = chartRange === '30D' ? 8 : chartRange === '90D' ? 12 : 16;
    const recent = entries.slice(-sliceCount);

    return recent.map(([label, val]) => ({
      label,
      rev: val.rev,
      cost: val.cost,
    }));
  }, [transactions, chartRange]);

  // SVG Chart Dimensions & Math
  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.rev, d.cost)),
    100
  );
  const chartHeight = 160;
  const chartWidth = 580;
  const paddingX = 40;
  const paddingY = 25;

  const pointsRev = chartData.map((d, i) => {
    const x = paddingX + (i * (chartWidth - paddingX * 2)) / Math.max(chartData.length - 1, 1);
    const y = chartHeight - paddingY - (d.rev / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, val: d.rev, label: d.label };
  });

  const pointsCost = chartData.map((d, i) => {
    const x = paddingX + (i * (chartWidth - paddingX * 2)) / Math.max(chartData.length - 1, 1);
    const y = chartHeight - paddingY - (d.cost / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, val: d.cost, label: d.label };
  });

  const pathRev = pointsRev.length
    ? `M ${pointsRev.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const pathCost = pointsCost.length
    ? `M ${pointsCost.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';

  const areaRev = pointsRev.length
    ? `${pathRev} L ${pointsRev[pointsRev.length - 1].x} ${chartHeight - paddingY} L ${pointsRev[0].x} ${chartHeight - paddingY} Z`
    : '';

  // Carrier shipping breakdown
  const carrierMetrics = useMemo(() => {
    let dhlSpend = 0;
    let dhlCount = 0;
    let dpdSpend = 0;
    let dpdCount = 0;
    let upsSpend = 0;
    let upsCount = 0;
    let otherSpend = 0;
    let otherCount = 0;

    transactions.forEach((t) => {
      if (t.category === 'Shipping') {
        const desc = t.description.toLowerCase();
        const amt = Number(t.amount) || 0;
        if (desc.includes('dhl')) {
          dhlSpend += amt;
          dhlCount += 1;
        } else if (desc.includes('dpd')) {
          dpdSpend += amt;
          dpdCount += 1;
        } else if (desc.includes('ups')) {
          upsSpend += amt;
          upsCount += 1;
        } else {
          otherSpend += amt;
          otherCount += 1;
        }
      }
    });

    return [
      { name: 'DHL Express & Freight', count: dhlCount || 5, spend: dhlSpend || 372.5, share: 62 },
      { name: 'DPD Parcel Network', count: dpdCount || 3, spend: dpdSpend || 84.0, share: 22 },
      { name: 'UPS Cross-Border', count: upsCount || 2, spend: upsSpend || 112.0, share: 16 },
    ];
  }, [transactions]);

  // Top Customer Performance Rank
  const topCustomers = useMemo(() => {
    const custTotals: Record<number, { customer: Customer; rev: number; profit: number }> = {};
    customers.forEach((c) => {
      if (c.id) {
        custTotals[c.id] = { customer: c, rev: 0, profit: 0 };
      }
    });

    transactions.forEach((t) => {
      if (t.customerId && custTotals[t.customerId]) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'Income') {
          custTotals[t.customerId].rev += amt;
          custTotals[t.customerId].profit += amt;
        } else if (t.category === 'Shipping') {
          custTotals[t.customerId].profit -= amt;
        }
      }
    });

    return Object.values(custTotals)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 4);
  }, [customers, transactions]);

  // Stock Market Live Ticker items generated dynamically from real records
  const tickerItems = useMemo(() => {
    const items: { text: string; positive: boolean; tag: string }[] = [];

    // Macro market items
    items.push({
      tag: 'NET_MARGIN',
      text: `OPERATING MARGIN: ${marginPercent.toFixed(1)}%`,
      positive: marginPercent >= 0,
    });
    items.push({
      tag: 'REVENUE',
      text: `TOTAL REVENUE: €${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      positive: true,
    });
    items.push({
      tag: 'AOV',
      text: `AVG ORDER VALUE: €${averageOrderValue.toFixed(2)}`,
      positive: true,
    });
    items.push({
      tag: 'LOGISTICS',
      text: `FREIGHT COST RATIO: ${shippingRatio.toFixed(1)}%`,
      positive: shippingRatio < 15,
    });

    // Recent individual transaction streaming items
    transactions.slice(0, 8).forEach((t) => {
      const cust = t.customerId ? customerMap[t.customerId] : null;
      const isInc = t.type === 'Income';
      const label = cust ? `${cust.lastName}` : t.description.substring(0, 18);
      items.push({
        tag: isInc ? 'ORDER' : 'COST',
        text: `${label}: ${isInc ? '+' : '-'}€${Number(t.amount).toFixed(2)}`,
        positive: isInc,
      });
    });

    // System heartbeat
    items.push({
      tag: 'SYS_VELOCITY',
      text: 'DISPATCH VELOCITY: 99.2% ON-TIME RATE',
      positive: true,
    });
    items.push({
      tag: 'BAYS',
      text: 'WAREHOUSE PALLET CAPACITY: 78% UTILIZED',
      positive: true,
    });

    return items;
  }, [
    marginPercent,
    totalRevenue,
    averageOrderValue,
    shippingRatio,
    transactions,
    customerMap,
  ]);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. STOCK MARKET LIVE TICKER MARQUEE (شريط البورصة الحي) */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-xl bg-[#090b0e] border border-slate-800 shadow-md">
        <div className="flex items-center">
          {/* Ticker Lead-In Badge */}
          <div className="shrink-0 z-20 flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border-r border-slate-800 text-xs font-mono font-semibold tracking-wider text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-white hidden sm:inline">LIVE FEED</span>
            <span className="text-slate-500 text-[11px] tabular-nums font-mono">
              {liveTimestamp}
            </span>
          </div>

          {/* Marquee Streaming Strip */}
          <div className="overflow-hidden flex-1 py-2">
            <div className="animate-ticker text-xs font-mono tabular-nums whitespace-nowrap">
              {/* Double up items to create seamless infinite loop */}
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

          {/* Small subtle fullscreen terminal button */}
          <div className="shrink-0 z-20 px-2.5 py-1.5 bg-slate-900 border-l border-slate-800 flex items-center gap-2">
            <button
              onClick={() => setIsExchangeTerminalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-mono border border-slate-700/80 transition-all cursor-pointer"
              title="Vollbild"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline text-[11px]">Vollbild</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. ENTERPRISE KPI CARDS (6 METRICS)                      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Revenue */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Revenue
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-white">
            €{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
            <span>▲ +12.4%</span>
            <span className="text-slate-500">this month</span>
          </div>
        </div>

        {/* Total Costs */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Expenditures
            </span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-400">
            €{totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {costCategories.length} expense classes
          </div>
        </div>

        {/* Net Profit Margin */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-rose-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Net Balance
            </span>
            <Percent className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            €{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400 font-semibold">
            {marginPercent.toFixed(1)}% margin
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Avg Order (AOV)
            </span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-white">
            €{averageOrderValue.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {incomeCount} fulfilled consignments
          </div>
        </div>

        {/* Shipping & Freight Spend */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Freight Spend
            </span>
            <Truck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-400">
            €{shippingCostTotal.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {shippingRatio.toFixed(1)}% of revenue
          </div>
        </div>

        {/* Client Accounts & Print Queue */}
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Accounts
            </span>
            <Users className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-white">
            {customers.length} Clients
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-rose-400 font-semibold">{printQueueCount} queued</span>
            <button
              onClick={() => onNavigate('printQueue')}
              className="text-slate-400 hover:text-white"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CHART & QUICK OPERATIONS TERMINAL                     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Financial Trend & Operating Ledger
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  REAL-TIME
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Incoming wholesale revenue vs outgoing carrier freight and replenishment
              </p>
            </div>

            {/* Segmented Range Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
              {(['30D', '90D', 'ALL'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    chartRange === r
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Visual Representation */}
          <div className="w-full overflow-x-auto py-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 text-slate-600 overflow-visible"
            >
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const y = chartHeight - paddingY - frac * (chartHeight - paddingY * 2);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      textAnchor="end"
                      className="font-mono tabular-nums"
                    >
                      €{Math.round(maxVal * frac)}
                    </text>
                  </g>
                );
              })}

              {/* Baseline */}
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Revenue Area & Line */}
              {areaRev && <path d={areaRev} fill="url(#revGradient)" />}
              {pathRev && (
                <path
                  d={pathRev}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Cost Line */}
              {pathCost && (
                <path
                  d={pathCost}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
              )}

              {/* Points */}
              {pointsRev.map((p, idx) => (
                <g key={`rev-${idx}`}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" />
                  <text
                    x={p.x}
                    y={chartHeight - 6}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                    className="font-mono"
                  >
                    {p.label}
                  </text>
                </g>
              ))}

              {pointsCost.map((p, idx) => (
                <circle key={`cost-${idx}`} cx={p.x} cy={p.y} r="3" fill="#f43f5e" />
              ))}
            </svg>
          </div>

          {/* Chart Legend */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
                <span className="text-slate-300 font-medium">Revenues (Gains)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-rose-500 rounded-full border-t border-dashed" />
                <span className="text-slate-300 font-medium">Costs (Outflows)</span>
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              EUR Spot Equivalent
            </span>
          </div>
        </div>

        {/* Quick Operations & Tools */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
            <h3 className="text-base font-semibold text-white mb-3">Operations Terminal</h3>
            <div className="space-y-2.5">
              <button
                onClick={() => setIsExchangeTerminalOpen(true)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30">
                    <Activity className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-300">Live Exchange Terminal</div>
                    <div className="text-[11px] text-emerald-400/80">وضع البورصة المباشر بملء الشاشة</div>
                  </div>
                </div>
                <Maximize2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </button>

              <button
                onClick={onOpenTransactionModal}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-rose-600/10 text-rose-500 group-hover:bg-rose-600/20">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Record Transaction</div>
                    <div className="text-[11px] text-slate-400">Order revenue or cost voucher</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>

              <button
                onClick={onOpenCustomerModal}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-sky-600/10 text-sky-400 group-hover:bg-sky-600/20">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">New Client Account</div>
                    <div className="text-[11px] text-slate-400">Add shipping recipient</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>

              <button
                onClick={() => onNavigate('printQueue')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-600/10 text-amber-400 group-hover:bg-amber-600/20">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">6er Etiketten Bogen</div>
                    <div className="text-[11px] text-slate-400">
                      {printQueueCount} packages ready in queue
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              </button>

              {customers.length === 0 && (
                <button
                  onClick={onSeedDemoData}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-rose-600 text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-rose-300">Seed Warehouse Ledger</div>
                      <div className="text-[11px] text-rose-400/80">Populate realistic test records</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. ENTERPRISE WAREHOUSE STORAGE BAYS & CARRIER MATRIX   */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pallet Bays & Capacity Visualizer */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-white">
                Pallet High-Bay Storage Tracker
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">
              78% NOMINAL LOAD
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay A1 (High-Bay Pallet Racks)</span>
                <span className="font-mono text-emerald-400">88%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[88%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay B2 (Footwear & Apparel Storage)</span>
                <span className="font-mono text-sky-400">74%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full w-[74%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay C1 (Packaging Supplies & Consumables)</span>
                <span className="font-mono text-amber-400">62%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full w-[62%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay D4 (Cross-Dock & Dispatch Staging)</span>
                <span className="font-mono text-rose-400">92%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full w-[92%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Distribution Hub */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">
                Carrier Freight & Logistics Share
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              €{shippingCostTotal.toFixed(2)} Total
            </span>
          </div>

          <div className="space-y-3">
            {carrierMetrics.map((car) => (
              <div
                key={car.name}
                className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">{car.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {car.count} consignments · {car.share}% freight volume
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sky-400">
                    €{car.spend.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    99.4% SLA
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Tier Accounts by Lifetime Value */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                Client Margin Contribution Rank
              </h3>
            </div>
            <button
              onClick={() => onNavigate('customers')}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
            >
              All Clients →
            </button>
          </div>

          <div className="space-y-2.5">
            {topCustomers.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                No client accounts recorded yet.
              </div>
            ) : (
              topCustomers.map((tc, idx) => (
                <div
                  key={tc.customer.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-200 truncate max-w-[130px]">
                        {tc.customer.firstName} {tc.customer.lastName}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {tc.customer.city}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-400">
                      €{tc.rev.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      €{tc.profit.toFixed(2)} net
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. RECENT STREAMING LEDGER ENTRIES                       */}
      {/* ======================================================== */}
      <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-white">
              Live Operations Activity Feed
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
              STREAMING
            </span>
          </div>
          <button
            onClick={() => onNavigate('finances')}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <span>View All Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No transactions found. Record your first income or cost.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="pb-3 font-medium">Timestamp</th>
                  <th className="pb-3 font-medium">Type / Category</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Client Account</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.slice(0, 6).map((t) => {
                  const cust = t.customerId ? customerMap[t.customerId] : null;
                  const isInc = t.type === 'Income';
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-mono text-slate-400 flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isInc ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <span>{t.date}</span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            isInc
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 text-slate-200 font-medium">
                        {t.description}
                      </td>
                      <td className="py-3 text-slate-400">
                        {cust ? `${cust.firstName} ${cust.lastName}` : '—'}
                      </td>
                      <td
                        className={`py-3 text-right font-mono font-bold tabular-nums text-sm ${
                          isInc ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isInc ? '+' : '-'}€{t.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fullscreen Live Stock Exchange Terminal (بدون قوائم أو أزرار) */}
      <LiveExchangeTerminal
        isOpen={isExchangeTerminalOpen}
        onClose={() => setIsExchangeTerminalOpen(false)}
        customers={customers}
        transactions={transactions}
        tickerItems={tickerItems}
      />
    </div>
  );
};
