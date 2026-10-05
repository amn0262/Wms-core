import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Phone,
  Mail,
  Scale,
  BookOpen,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import type { Supplier, SupplierTransaction } from '../types';
import { SupplierLedgerModal } from './SupplierLedgerModal';

interface SuppliersViewProps {
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  onOpenSupplierModal: (supplierToEdit?: Supplier) => void;
  onOpenTransactionModal: (
    supplierId?: number,
    defaultType?: 'Bill' | 'Payment',
    suggestedAmount?: number,
    editingTx?: SupplierTransaction
  ) => void;
  onDeleteSupplier: (id: number) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  supplierTransactions,
  onOpenSupplierModal,
  onOpenTransactionModal,
  onDeleteSupplier,
  onDeleteTransaction,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'operations'>('accounts');
  const [chartRange, setChartRange] = useState<'30D' | '90D' | 'ALL'>('30D');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBT' | 'CREDIT' | 'SETTLED'>('ALL');
  const [sortBy, setSortBy] = useState<'debt' | 'name' | 'bills' | 'payments'>('debt');
  const [activeLedgerSupplier, setActiveLedgerSupplier] = useState<Supplier | null>(null);

  // Filters for Operations Log sub-tab
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'Bill' | 'Payment'>('ALL');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const supplierMap = useMemo(() => {
    const map: Record<number, Supplier> = {};
    suppliers.forEach((s) => {
      if (s.id) map[s.id] = s;
    });
    return map;
  }, [suppliers]);

  // Compute live balances per supplier
  const supplierBalances = useMemo(() => {
    const stats: Record<
      number,
      {
        totalBills: number;
        totalPayments: number;
        balance: number; // positive = we owe, negative = credit
        transactionCount: number;
      }
    > = {};

    suppliers.forEach((s) => {
      if (s.id) {
        stats[s.id] = {
          totalBills: 0,
          totalPayments: 0,
          balance: 0,
          transactionCount: 0,
        };
      }
    });

    supplierTransactions.forEach((st) => {
      if (st.supplierId && stats[st.supplierId]) {
        const amt = Number(st.amount) || 0;
        stats[st.supplierId].transactionCount += 1;
        if (st.type === 'Bill') {
          stats[st.supplierId].totalBills += amt;
          stats[st.supplierId].balance += amt;
        } else {
          stats[st.supplierId].totalPayments += amt;
          stats[st.supplierId].balance -= amt;
        }
      }
    });

    return stats;
  }, [suppliers, supplierTransactions]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    let totalDebt = 0;
    let totalCredit = 0;
    let debtCount = 0;
    let creditCount = 0;
    let settledCount = 0;
    let sumBills = 0;
    let sumPayments = 0;

    Object.values(supplierBalances).forEach((stat) => {
      sumBills += stat.totalBills;
      sumPayments += stat.totalPayments;
      if (stat.balance > 0.01) {
        totalDebt += stat.balance;
        debtCount += 1;
      } else if (stat.balance < -0.01) {
        totalCredit += Math.abs(stat.balance);
        creditCount += 1;
      } else {
        settledCount += 1;
      }
    });

    return {
      totalDebt,
      totalCredit,
      netExposure: totalDebt - totalCredit,
      debtCount,
      creditCount,
      settledCount,
      sumBills,
      sumPayments,
    };
  }, [supplierBalances]);

  // Supplier Trend Chart Data (Bills vs Payments over Time)
  const trendData = useMemo(() => {
    const dateMap: Record<
      string,
      { rawDate: string; label: string; bills: number; payments: number }
    > = {};

    supplierTransactions.forEach((st) => {
      const d = new Date(st.date);
      const label = isNaN(d.getTime()) ? st.date : `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dateMap[st.date]) {
        dateMap[st.date] = { rawDate: st.date, label, bills: 0, payments: 0 };
      }
      const amt = Number(st.amount) || 0;
      if (st.type === 'Bill') dateMap[st.date].bills += amt;
      else dateMap[st.date].payments += amt;
    });

    const sorted = Object.values(dateMap).sort(
      (a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
    );
    const sliceCount = chartRange === '30D' ? 8 : chartRange === '90D' ? 12 : 18;
    const recent = sorted.slice(-sliceCount);

    if (recent.length === 0) {
      return [
        { rawDate: '-', label: 'D1', bills: 0, payments: 0 },
        { rawDate: '-', label: 'D2', bills: 0, payments: 0 },
      ];
    }
    return recent;
  }, [supplierTransactions, chartRange]);

  // SVG Math
  const chartW = 680;
  const chartH = 145;
  const padX = 44;
  const padY = 22;
  const maxTrendVal = Math.max(
    ...trendData.map((d) => Math.max(d.bills, d.payments)),
    100
  );

  const ptsBills = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.bills / maxTrendVal) * (chartH - padY * 2);
    return { x, y, val: d.bills, label: d.label };
  });

  const ptsPayments = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.payments / maxTrendVal) * (chartH - padY * 2);
    return { x, y, val: d.payments, label: d.label };
  });

  const pathBills = ptsBills.length
    ? `M ${ptsBills.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const pathPayments = ptsPayments.length
    ? `M ${ptsPayments.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';

  // Filtered & sorted supplier list
  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter((s) => {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          s.name.toLowerCase().includes(query) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(query)) ||
          (s.notes && s.notes.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        const bal = s.id ? supplierBalances[s.id]?.balance || 0 : 0;
        if (statusFilter === 'DEBT') return bal > 0.01;
        if (statusFilter === 'CREDIT') return bal < -0.01;
        if (statusFilter === 'SETTLED') return Math.abs(bal) <= 0.01;

        return true;
      })
      .sort((a, b) => {
        const balA = a.id ? supplierBalances[a.id]?.balance || 0 : 0;
        const balB = b.id ? supplierBalances[b.id]?.balance || 0 : 0;
        const billsA = a.id ? supplierBalances[a.id]?.totalBills || 0 : 0;
        const billsB = b.id ? supplierBalances[b.id]?.totalBills || 0 : 0;
        const payA = a.id ? supplierBalances[a.id]?.totalPayments || 0 : 0;
        const payB = b.id ? supplierBalances[b.id]?.totalPayments || 0 : 0;

        if (sortBy === 'debt') return balB - balA;
        if (sortBy === 'bills') return billsB - billsA;
        if (sortBy === 'payments') return payB - payA;
        return a.name.localeCompare(b.name);
      });
  }, [suppliers, searchTerm, statusFilter, sortBy, supplierBalances]);

  // Filtered Supplier Transactions for Operations Log
  const filteredSupplierTxs = useMemo(() => {
    return supplierTransactions
      .filter((st) => {
        if (txTypeFilter !== 'ALL' && st.type !== txTypeFilter) return false;
        if (
          selectedSupplierFilter !== 'ALL' &&
          String(st.supplierId) !== selectedSupplierFilter
        ) {
          return false;
        }
        if (startDate && new Date(st.date) < new Date(startDate)) return false;
        if (endDate && new Date(st.date) > new Date(endDate)) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const sup = supplierMap[st.supplierId];
          const supName = sup ? sup.name.toLowerCase() : '';
          const desc = (st.description || '').toLowerCase();
          const ref = (st.referenceInvoice || '').toLowerCase();
          if (!supName.includes(q) && !desc.includes(q) && !ref.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.timestamp - a.timestamp
      );
  }, [
    supplierTransactions,
    txTypeFilter,
    selectedSupplierFilter,
    startDate,
    endDate,
    searchTerm,
    supplierMap,
  ]);

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#141820] border border-rose-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4" />
              Total Outstanding Goods Debt
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {overallStats.debtCount} {overallStats.debtCount === 1 ? 'Supplier' : 'Suppliers'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            €{overallStats.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Accounts payable: total money currently owed for inventory & goods
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              Advance Goods Credits
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {overallStats.creditCount} {overallStats.creditCount === 1 ? 'Supplier' : 'Suppliers'}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            €{overallStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Overpayments or advance deposits held with merchandise suppliers
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" />
              Net Payables Exposure
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {suppliers.length} Total Suppliers
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              overallStats.netExposure > 0
                ? 'text-rose-400'
                : overallStats.netExposure < 0
                ? 'text-emerald-400'
                : 'text-slate-200'
            }`}
          >
            €{Math.abs(overallStats.netExposure).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {overallStats.netExposure > 0
              ? 'Net payable balance across all merchandise suppliers'
              : overallStats.netExposure < 0
              ? 'Net surplus in supplier deposits'
              : 'All merchandise supplier accounts are fully settled'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-400" />
              Total Goods Invoiced vs Paid
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {supplierTransactions.length} Entries
            </span>
          </div>
          <div className="flex items-baseline justify-between text-sm font-mono mt-1">
            <span className="text-slate-400 text-xs">Billed:</span>
            <span className="text-white font-bold">€{overallStats.sumBills.toFixed(2)}</span>
          </div>
          <div className="flex items-baseline justify-between text-sm font-mono mt-1">
            <span className="text-slate-400 text-xs">Paid:</span>
            <span className="text-emerald-400 font-bold">€{overallStats.sumPayments.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 2. SUPPLIERS GOODS PURCHASES VS PAYMENTS TREND CHART */}
      <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">
                Supplier Merchandise Purchases (Bills) vs Settlements Trend
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological comparison of invoiced goods deliveries vs payments sent to suppliers
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            {(['30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  chartRange === r
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-36 text-slate-600 overflow-visible"
          >
            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const y = chartH - padY - frac * (chartH - padY * 2);
              return (
                <g key={idx}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={chartW - padX}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padX - 6}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="end"
                    className="font-mono"
                  >
                    €{Math.round(maxTrendVal * frac)}
                  </text>
                </g>
              );
            })}
            <line
              x1={padX}
              y1={chartH - padY}
              x2={chartW - padX}
              y2={chartH - padY}
              stroke="#334155"
              strokeWidth="1"
            />
            {pathBills && (
              <path
                d={pathBills}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {pathPayments && (
              <path
                d={pathPayments}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
              />
            )}
            {ptsBills.map((p, idx) => (
              <g key={`b-${idx}`}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="#f43f5e" />
                <text
                  x={p.x}
                  y={chartH - 5}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {p.label}
                </text>
              </g>
            ))}
            {ptsPayments.map((p, idx) => (
              <circle key={`p-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#10b981" />
            ))}
          </svg>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-rose-500 rounded-full" />
              <span className="text-slate-300">Goods Invoiced / Bills (€{overallStats.sumBills.toFixed(2)})</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full border-t border-dashed" />
              <span className="text-slate-300">Supplier Payments (€{overallStats.sumPayments.toFixed(2)})</span>
            </span>
          </div>
          <span className="font-mono text-rose-400 font-semibold">
            Net Owed: €{overallStats.totalDebt.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 3. CONTROLS, SUB-TABS, SEARCH & ACTIONS */}
      <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Sub-Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('accounts')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeSubTab === 'accounts'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Supplier Accounts ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('operations')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeSubTab === 'operations'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Goods Bills & Payments Log ({supplierTransactions.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                activeSubTab === 'accounts'
                  ? 'Search merchandise suppliers by company name, contact person, or notes...'
                  : 'Search bills & payments by supplier, invoice reference, or item description...'
              }
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenTransactionModal(undefined, 'Bill')}
              className="px-3.5 py-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>+ Record Goods Bill</span>
            </button>

            <button
              onClick={() => onOpenTransactionModal(undefined, 'Payment')}
              className="px-3.5 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+ Record Payment</span>
            </button>

            <button
              onClick={() => onOpenSupplierModal()}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ New Goods Supplier</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Specific Filters */}
        {activeSubTab === 'accounts' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium mr-1 text-[11px]">Filter Account:</span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({suppliers.length})
              </button>
              <button
                onClick={() => setStatusFilter('DEBT')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'DEBT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                In Debt ({overallStats.debtCount})
              </button>
              <button
                onClick={() => setStatusFilter('CREDIT')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'CREDIT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                In Surplus ({overallStats.creditCount})
              </button>
              <button
                onClick={() => setStatusFilter('SETTLED')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'SETTLED'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Settled ({overallStats.settledCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none"
              >
                <option value="debt">Highest Debt / Balance First</option>
                <option value="name">Supplier Name (A-Z)</option>
                <option value="bills">Highest Invoiced Volume</option>
                <option value="payments">Highest Paid Volume</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-[11px]">Type:</span>
              {(['ALL', 'Bill', 'Payment'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    txTypeFilter === t
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'ALL' ? 'All Entries' : t === 'Bill' ? 'Goods Bills (Invoiced)' : 'Payments (Settled)'}
                </button>
              ))}

              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none ml-2"
              >
                <option value="ALL">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-[11px]">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-mono"
              />
              <span className="text-slate-400 text-[11px]">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-mono"
              />
              {(startDate || endDate || txTypeFilter !== 'ALL' || selectedSupplierFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setTxTypeFilter('ALL');
                    setSelectedSupplierFilter('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. CONTENT: ACCOUNTS TABLE OR OPERATIONS LOG TABLE */}
      {activeSubTab === 'accounts' ? (
        filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#141820] border border-slate-800 text-slate-400 space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-200">No Goods Suppliers Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add your merchandise & inventory suppliers to manage delivery bills, settlement payments, and live accounts payable balances.
            </p>
            <button
              onClick={() => onOpenSupplierModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add First Goods Supplier</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#141820]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4">Contact Person & Info</th>
                  <th className="py-3.5 px-4 text-right">Invoiced (Bills)</th>
                  <th className="py-3.5 px-4 text-right">Paid (Settled)</th>
                  <th className="py-3.5 px-4 text-right">Account Balance</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredSuppliers.map((supplier) => {
                  const stat = supplier.id ? supplierBalances[supplier.id] : null;
                  const balance = stat?.balance || 0;
                  const isDebt = balance > 0.01;
                  const isCredit = balance < -0.01;

                  return (
                    <tr key={supplier.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{supplier.name}</div>
                        {supplier.notes && (
                          <div
                            className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5"
                            title={supplier.notes}
                          >
                            {supplier.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="font-medium text-slate-200">
                          {supplier.contactPerson || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {supplier.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {supplier.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-200">
                        €{(stat?.totalBills || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-400">
                        €{(stat?.totalPayments || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            isDebt
                              ? 'text-rose-400'
                              : isCredit
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          €{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {isDebt ? 'We owe' : isCredit ? 'Surplus credit' : 'Balanced'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isDebt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" /> Debt (Payable)
                          </span>
                        ) : isCredit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Surplus (Credit)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Settled
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveLedgerSupplier(supplier)}
                            title="View Statement of Account / Ledger"
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                            <span>Ledger</span>
                          </button>

                          {isDebt && (
                            <button
                              onClick={() =>
                                supplier.id &&
                                onOpenTransactionModal(supplier.id, 'Payment', balance)
                              }
                              title="Settle debt"
                              className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer"
                            >
                              Pay €{balance.toFixed(2)}
                            </button>
                          )}

                          <button
                            onClick={() =>
                              supplier.id && onOpenTransactionModal(supplier.id, 'Bill')
                            }
                            title="Record new goods bill"
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenSupplierModal(supplier)}
                            title="Edit supplier"
                            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (
                                supplier.id &&
                                window.confirm(`Delete supplier "${supplier.name}"?`)
                              ) {
                                onDeleteSupplier(supplier.id);
                              }
                            }}
                            title="Delete supplier"
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ALL SUPPLIER OPERATIONS LOG TABLE (WITH EDIT & DELETE) */
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#141820]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Operation Type</th>
                <th className="py-3.5 px-4">Supplier Account</th>
                <th className="py-3.5 px-4">Goods / Payment Description</th>
                <th className="py-3.5 px-4">Invoice / Method</th>
                <th className="py-3.5 px-4 text-right">Amount (€)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSupplierTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No supplier bills or payments match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSupplierTxs.map((st) => {
                  const sup = supplierMap[st.supplierId];
                  const isBill = st.type === 'Bill';
                  return (
                    <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {st.date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isBill
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isBill ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> Goods Bill
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> Payment
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {sup ? sup.name : `Supplier #${st.supplierId}`}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">{st.description}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {st.referenceInvoice || '—'}
                        {st.paymentMethod && (
                          <span className="text-[10px] text-slate-500 block font-sans">
                            {st.paymentMethod}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          isBill ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isBill ? '-' : '+'}€{Number(st.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              onOpenTransactionModal(st.supplierId, st.type, undefined, st)
                            }
                            title="Edit supplier entry"
                            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                st.id &&
                                window.confirm(`Delete supplier ${st.type.toLowerCase()} "${st.description}"?`)
                              ) {
                                onDeleteTransaction(st.id);
                              }
                            }}
                            title="Delete supplier entry"
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Statement of Account / Ledger Modal */}
      <SupplierLedgerModal
        isOpen={!!activeLedgerSupplier}
        onClose={() => setActiveLedgerSupplier(null)}
        supplier={activeLedgerSupplier}
        transactions={supplierTransactions}
        onOpenNewTransaction={(sId, dType, sAmount) => {
          onOpenTransactionModal(sId, dType, sAmount);
        }}
        onEditTransaction={(tx) => {
          onOpenTransactionModal(tx.supplierId, tx.type, undefined, tx);
        }}
        onDeleteTransaction={onDeleteTransaction}
      />
    </div>
  );
};
