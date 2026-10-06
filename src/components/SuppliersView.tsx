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
import { useI18n } from '../utils/i18n';

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
  const { tr, translatePaymentMethod } = useI18n();
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
              {tr('Total Outstanding Goods Debt', 'إجمالي ديون البضائع المستحقة')}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {overallStats.debtCount}{' '}
              {overallStats.debtCount === 1
                ? tr('Supplier', 'مورد')
                : tr('Suppliers', 'موردين')}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            €{overallStats.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {tr(
              'Accounts payable: total money currently owed for inventory & goods',
              'الحسابات الدائنة: إجمالي المبالغ المستحقة حالياً للموردين مقابل البضائع والمخزون'
            )}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              {tr('Advance Goods Credits', 'رصيد دائن مقدم للموردين')}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {overallStats.creditCount}{' '}
              {overallStats.creditCount === 1
                ? tr('Supplier', 'مورد')
                : tr('Suppliers', 'موردين')}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            €{overallStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {tr(
              'Overpayments or advance deposits held with merchandise suppliers',
              'المدفوعات الزائدة أو العربون المقدم لدى موردي البضائع'
            )}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-400" />
              {tr('Net Payables Exposure', 'صافي التزامات الموردين')}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {suppliers.length} {tr('Total Suppliers', 'إجمالي الموردين')}
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
              ? tr(
                  'Net payable balance across all merchandise suppliers',
                  'صافي الرصيد المستحق الدفع لجميع موردي البضائع'
                )
              : overallStats.netExposure < 0
              ? tr('Net surplus in supplier deposits', 'صافي فائض الودائع لدى الموردين')
              : tr(
                  'All merchandise supplier accounts are fully settled',
                  'جميع حسابات موردي البضائع مسددة بالكامل'
                )}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-400" />
              {tr('Total Goods Invoiced vs Paid', 'إجمالي الفواتير مقابل المدفوع')}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {supplierTransactions.length} {tr('Entries', 'عملية')}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-sm font-mono mt-1">
            <span className="text-slate-400 text-xs">{tr('Billed:', 'المفوتر:')}</span>
            <span className="text-white font-bold">€{overallStats.sumBills.toFixed(2)}</span>
          </div>
          <div className="flex items-baseline justify-between text-sm font-mono mt-1">
            <span className="text-slate-400 text-xs">{tr('Paid:', 'المدفوع:')}</span>
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
                {tr(
                  'Supplier Merchandise Purchases (Bills) vs Settlements Trend',
                  'مؤشر فواتير شراء البضائع مقابل دفعات تسوية الموردين'
                )}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {tr(
                'Chronological comparison of invoiced goods deliveries vs payments sent to suppliers',
                'مقارنة زمنية بين فواتير استلام البضائع والدفعات المرسلة للموردين'
              )}
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
                {r === 'ALL' ? tr('ALL', 'الكل') : r}
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
              <span className="text-slate-300">
                {tr('Goods Invoiced / Bills', 'فواتير البضائع المستلمة')} (€{overallStats.sumBills.toFixed(2)})
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full border-t border-dashed" />
              <span className="text-slate-300">
                {tr('Supplier Payments', 'دفعات الموردين')} (€{overallStats.sumPayments.toFixed(2)})
              </span>
            </span>
          </div>
          <span className="font-mono text-rose-400 font-semibold">
            {tr('Net Owed:', 'صافي الدين المستحق:')} €{overallStats.totalDebt.toFixed(2)}
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
              {tr('Supplier Accounts', 'حسابات الموردين')} ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('operations')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                activeSubTab === 'operations'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tr('All Goods Bills & Payments Log', 'سجل جميع فواتير البضائع والدفعات')} ({supplierTransactions.length})
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
                  ? tr(
                      'Search merchandise suppliers by company name, contact person, or notes...',
                      'ابحث عن الموردين حسب اسم الشركة، جهة الاتصال، أو الملاحظات...'
                    )
                  : tr(
                      'Search bills & payments by supplier, invoice reference, or item description...',
                      'ابحث في الفواتير والدفعات حسب المورد، رقم الفاتورة، أو الوصف...'
                    )
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
              <span>{tr('+ Record Goods Bill', '+ تسجيل فاتورة بضاعة')}</span>
            </button>

            <button
              onClick={() => onOpenTransactionModal(undefined, 'Payment')}
              className="px-3.5 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{tr('+ Record Payment', '+ تسجيل دفعة لمورد')}</span>
            </button>

            <button
              onClick={() => onOpenSupplierModal()}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{tr('+ New Goods Supplier', '+ مورد بضائع جديد')}</span>
            </button>
          </div>
        </div>

        {/* Sub-tab Specific Filters */}
        {activeSubTab === 'accounts' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium mr-1 text-[11px]">
                {tr('Filter Account:', 'تصفية الحساب:')}
              </span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('All', 'الكل')} ({suppliers.length})
              </button>
              <button
                onClick={() => setStatusFilter('DEBT')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'DEBT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('In Debt', 'علينا دين')} ({overallStats.debtCount})
              </button>
              <button
                onClick={() => setStatusFilter('CREDIT')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'CREDIT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('In Surplus', 'رصيد فائض')} ({overallStats.creditCount})
              </button>
              <button
                onClick={() => setStatusFilter('SETTLED')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'SETTLED'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('Settled', 'مسدد')} ({overallStats.settledCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">{tr('Sort By:', 'ترتيب حسب:')}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none"
              >
                <option value="debt">{tr('Highest Debt / Balance First', 'الأعلى ديناً أولاً')}</option>
                <option value="name">{tr('Supplier Name (A-Z)', 'اسم المورد (أ-ي)')}</option>
                <option value="bills">{tr('Highest Invoiced Volume', 'الأعلى حجماً في الفواتير')}</option>
                <option value="payments">{tr('Highest Paid Volume', 'الأعلى حجماً في الدفعات')}</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-[11px]">{tr('Type:', 'النوع:')}</span>
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
                  {t === 'ALL'
                    ? tr('All Entries', 'جميع السجلات')
                    : t === 'Bill'
                    ? tr('Goods Bills (Invoiced)', 'فواتير البضائع')
                    : tr('Payments (Settled)', 'الدفعات المسددة')}
                </button>
              ))}

              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none ml-2"
              >
                <option value="ALL">{tr('All Suppliers', 'جميع الموردين')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-[11px]">{tr('From:', 'من:')}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-mono"
              />
              <span className="text-slate-400 text-[11px]">{tr('To:', 'إلى:')}</span>
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
                  <RotateCcw className="w-3 h-3" /> {tr('Reset', 'إعادة ضبط')}
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
            <h3 className="text-sm font-semibold text-slate-200">
              {tr('No Goods Suppliers Found', 'لم يتم العثور على موردي بضائع')}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {tr(
                'Add your merchandise & inventory suppliers to manage delivery bills, settlement payments, and live accounts payable balances.',
                'أضف موردي البضائع والمخزون لإدارة فواتير التوريد، دفعات التسوية، وأرصدة الديون المستحقة مباشرة.'
              )}
            </p>
            <button
              onClick={() => onOpenSupplierModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{tr('Add First Goods Supplier', 'إضافة أول مورد بضائع')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#141820]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                  <th className="py-3.5 px-4">{tr('Supplier Name', 'اسم المورد')}</th>
                  <th className="py-3.5 px-4">{tr('Contact Person & Info', 'جهة الاتصال والمعلومات')}</th>
                  <th className="py-3.5 px-4 text-right">{tr('Invoiced (Bills)', 'المفوتر (الفواتير)')}</th>
                  <th className="py-3.5 px-4 text-right">{tr('Paid (Settled)', 'المدفوع (المسدد)')}</th>
                  <th className="py-3.5 px-4 text-right">{tr('Account Balance', 'رصيد الحساب')}</th>
                  <th className="py-3.5 px-4 text-center">{tr('Status', 'الحالة')}</th>
                  <th className="py-3.5 px-4 text-right">{tr('Actions', 'إجراءات')}</th>
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
                          {isDebt
                            ? tr('We owe', 'مستحق علينا')
                            : isCredit
                            ? tr('Surplus credit', 'رصيد فائض لنا')
                            : tr('Balanced', 'متوازن')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isDebt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" /> {tr('Debt (Payable)', 'دين (مستحق الدفع)')}
                          </span>
                        ) : isCredit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> {tr('Surplus (Credit)', 'فائض (دائن)')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            {tr('Settled', 'مسدد')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveLedgerSupplier(supplier)}
                            title={tr('View Statement of Account / Ledger', 'عرض كشف الحساب / الدفتر')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                            <span>{tr('Ledger', 'كشف الحساب')}</span>
                          </button>

                          {isDebt && (
                            <button
                              onClick={() =>
                                supplier.id &&
                                onOpenTransactionModal(supplier.id, 'Payment', balance)
                              }
                              title={tr('Settle debt', 'تسديد الدين')}
                              className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer"
                            >
                              {tr('Pay', 'سداد')} €{balance.toFixed(2)}
                            </button>
                          )}

                          <button
                            onClick={() =>
                              supplier.id && onOpenTransactionModal(supplier.id, 'Bill')
                            }
                            title={tr('Record new goods bill', 'تسجيل فاتورة بضاعة جديدة')}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenSupplierModal(supplier)}
                            title={tr('Edit supplier', 'تعديل المورد')}
                            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (
                                supplier.id &&
                                window.confirm(
                                  tr(
                                    `Delete supplier "${supplier.name}"?`,
                                    `هل أنت متأكد من حذف المورد "${supplier.name}"؟`
                                  )
                                )
                              ) {
                                onDeleteSupplier(supplier.id);
                              }
                            }}
                            title={tr('Delete supplier', 'حذف المورد')}
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
                <th className="py-3.5 px-4">{tr('Date', 'التاريخ')}</th>
                <th className="py-3.5 px-4">{tr('Operation Type', 'نوع العملية')}</th>
                <th className="py-3.5 px-4">{tr('Supplier Account', 'حساب المورد')}</th>
                <th className="py-3.5 px-4">{tr('Goods / Payment Description', 'وصف البضاعة / الدفعة')}</th>
                <th className="py-3.5 px-4">{tr('Invoice / Method', 'الفاتورة / طريقة الدفع')}</th>
                <th className="py-3.5 px-4 text-right">{tr('Amount (€)', 'المبلغ (€)')}</th>
                <th className="py-3.5 px-4 text-right">{tr('Actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSupplierTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    {tr(
                      'No supplier bills or payments match your filter criteria.',
                      'لا توجد فواتير أو دفعات موردين تطابق معايير البحث.'
                    )}
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
                              <ArrowDownLeft className="w-3 h-3" /> {tr('Goods Bill', 'فاتورة بضاعة')}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> {tr('Payment', 'دفعة مسددة')}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {sup ? sup.name : `${tr('Supplier', 'مورد')} #${st.supplierId}`}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">{st.description}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {st.referenceInvoice || '—'}
                        {st.paymentMethod && (
                          <span className="text-[10px] text-slate-500 block font-sans">
                            {translatePaymentMethod(st.paymentMethod)}
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
                            title={tr('Edit supplier entry', 'تعديل العملية')}
                            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                st.id &&
                                window.confirm(
                                  tr(
                                    `Delete supplier ${st.type.toLowerCase()} "${st.description}"?`,
                                    `هل أنت متأكد من حذف العملية "${st.description}"؟`
                                  )
                                )
                              ) {
                                onDeleteTransaction(st.id);
                              }
                            }}
                            title={tr('Delete supplier entry', 'حذف العملية')}
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
