import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  Filter,
  RotateCcw,
  TrendingUp,
  Edit2,
} from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { exportTransactionsToCSV } from '../utils/csvExport';
import { useI18n } from '../utils/i18n';

interface ReportsViewProps {
  transactions: Transaction[];
  customers: Customer[];
  onEditTransaction?: (tx: Transaction) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  customers,
  onEditTransaction,
}) => {
  const { tr, translateCategory } = useI18n();
  const [timePreset, setTimePreset] = useState<
    'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  >('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const customerMap = useMemo(() => {
    const map: Record<number, Customer> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [customers]);

  const isDateInRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timePreset === 'all') return true;
    if (timePreset === 'today') {
      return d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
    }
    if (timePreset === 'week') {
      const firstDay = new Date(today);
      firstDay.setDate(today.getDate() - today.getDay());
      return d >= firstDay;
    }
    if (timePreset === 'month') {
      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    }
    if (timePreset === 'quarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const testQuarter = Math.floor(d.getMonth() / 3);
      return (
        currentQuarter === testQuarter &&
        d.getFullYear() === today.getFullYear()
      );
    }
    if (timePreset === 'year') {
      return d.getFullYear() === today.getFullYear();
    }
    if (timePreset === 'custom') {
      if (startDate && new Date(dateStr) < new Date(startDate)) return false;
      if (endDate && new Date(dateStr) > new Date(endDate)) return false;
      return true;
    }
    return true;
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    return transactions
      .filter((t) => {
        if (!isDateInRange(t.date)) return false;
        if (
          selectedCustomerId !== 'all' &&
          String(t.customerId) !== selectedCustomerId
        ) {
          return false;
        }
        if (selectedCategory !== 'all' && t.category !== selectedCategory) {
          return false;
        }
        if (selectedType !== 'all' && t.type !== selectedType) {
          return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const descMatch = t.description.toLowerCase().includes(q);
          const invMatch = (t.invoiceNumber || '').toLowerCase().includes(q);
          const cust = t.customerId ? customerMap[t.customerId] : null;
          const custMatch = cust
            ? `${cust.firstName} ${cust.lastName} ${cust.city}`.toLowerCase().includes(q)
            : false;
          if (!descMatch && !invMatch && !custMatch) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions,
    timePreset,
    startDate,
    endDate,
    selectedCustomerId,
    selectedCategory,
    selectedType,
    searchTerm,
    customerMap,
  ]);

  // Aggregate KPI summary for filtered data
  const { filteredRevenue, filteredCosts, filteredNet, marginPercent } = useMemo(() => {
    let rev = 0;
    let costs = 0;
    filteredData.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.type === 'Income') rev += amt;
      else costs += amt;
    });
    const net = rev - costs;
    const margin = rev > 0 ? (net / rev) * 100 : 0;
    return {
      filteredRevenue: rev,
      filteredCosts: costs,
      filteredNet: net,
      marginPercent: margin,
    };
  }, [filteredData]);

  // Filtered Trend Line Data
  const trendData = useMemo(() => {
    const dateMap: Record<
      string,
      { rawDate: string; label: string; rev: number; cost: number }
    > = {};
    filteredData.forEach((f) => {
      const d = new Date(f.date);
      const label = isNaN(d.getTime()) ? f.date : `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dateMap[f.date]) {
        dateMap[f.date] = { rawDate: f.date, label, rev: 0, cost: 0 };
      }
      const amt = Number(f.amount) || 0;
      if (f.type === 'Income') dateMap[f.date].rev += amt;
      else dateMap[f.date].cost += amt;
    });

    const sorted = Object.values(dateMap).sort(
      (a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
    );
    if (sorted.length === 0) {
      return [
        { rawDate: '-', label: 'D1', rev: 0, cost: 0 },
        { rawDate: '-', label: 'D2', rev: 0, cost: 0 },
      ];
    }
    return sorted.slice(-16);
  }, [filteredData]);

  const chartW = 680;
  const chartH = 140;
  const padX = 44;
  const padY = 22;
  const maxVal = Math.max(...trendData.map((d) => Math.max(d.rev, d.cost)), 100);

  const ptsRev = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.rev / maxVal) * (chartH - padY * 2);
    return { x, y, label: d.label };
  });
  const ptsCost = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.cost / maxVal) * (chartH - padY * 2);
    return { x, y, label: d.label };
  });

  const pathRev = ptsRev.length
    ? `M ${ptsRev.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const pathCost = ptsCost.length
    ? `M ${ptsCost.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';

  const handleExportCSV = () => {
    exportTransactionsToCSV(
      filteredData,
      customerMap,
      `WMS_Report_${timePreset}_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetFilters = () => {
    setTimePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedCustomerId('all');
    setSelectedCategory('all');
    setSelectedType('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Filter Parameters Box */}
      <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Filter className="w-4 h-4 text-rose-500" />
            <span>{tr('Multi-Variable Analytics Filters', 'فلاتر التحليلات المتقدمة متعددة المتغيرات')}</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{tr('Reset Filters', 'إعادة ضبط الفلاتر')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Time Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {tr('Time Period', 'الفترة الزمنية')}
            </label>
            <select
              value={timePreset}
              onChange={(e) => setTimePreset(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">{tr('All Recorded History', 'كامل السجل التاريخي')}</option>
              <option value="today">{tr('Today', 'اليوم')}</option>
              <option value="week">{tr('This Week', 'هذا الأسبوع')}</option>
              <option value="month">{tr('This Month', 'هذا الشهر')}</option>
              <option value="quarter">{tr('This Quarter', 'هذا الربع السنوي')}</option>
              <option value="year">{tr('This Calendar Year', 'هذه السنة المالية')}</option>
              <option value="custom">{tr('Custom Date Range...', 'نطاق تاريخ مخصص...')}</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {tr('Client Account', 'حساب الزبون')}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">{tr('All Clients & Operations', 'جميع الزبائن والعمليات')}</option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.firstName} {c.lastName} ({c.city})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {tr('Category', 'التصنيف')}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">{tr('All Categories', 'جميع التصنيفات')}</option>
              <option value="Order Revenue">{tr('Order Revenue', 'إيرادات الطلبيات')}</option>
              <option value="Customer Payment">{tr('Customer Payment', 'دفعات الزبائن')}</option>
              <option value="Owner Capital Injection">{tr('Owner Capital Injection', 'إيداع من المال الخاص')}</option>
              <option value="Personal Withdrawal">{tr('Personal Withdrawal', 'سحب للاستخدام الشخصي')}</option>
              <option value="Shipping">{tr('Local Parcel Shipping', 'الشحن المحلي للطرود')}</option>
              <option value="Goods/Inventory">{tr('Goods / Inventory', 'شراء بضائع ومخزون')}</option>
              <option value="Packaging & Supplies">{tr('Packaging & Supplies', 'مواد التغليف والكراتين')}</option>
              <option value="Vehicle">{tr('Vehicle & Fuel', 'المركبات والوقود')}</option>
              <option value="Warehouse Rent">{tr('Warehouse Rent', 'إيجار المستودع')}</option>
              <option value="Other Income">{tr('Other Income', 'إيرادات أخرى')}</option>
              <option value="General">{tr('General', 'عام')}</option>
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              {tr('Product / Keyword Search', 'بحث بالمنتج / الكلمة المفتاحية')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr('e.g. Pallet, DHL, DPD, Boxes...', 'مثال: طبلية، DHL، كراتين...')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Custom Date Pickers */}
        {timePreset === 'custom' && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {tr('Start Date', 'تاريخ البداية')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {tr('End Date', 'تاريخ النهاية')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards for Filtered Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            {tr('Filtered Revenue', 'الإيرادات المفلترة')}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            €{filteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredData.filter((d) => d.type === 'Income').length}{' '}
            {tr('income entries', 'قيد إيرادات')}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            {tr('Filtered Costs', 'التكاليف المفلترة')}
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            €{filteredCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredData.filter((d) => d.type === 'Expense').length}{' '}
            {tr('cost entries', 'قيد تكاليف')}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            {tr('Filtered Net Margin', 'صافي الهامش المفلتر')}
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              filteredNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            €{filteredNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {marginPercent.toFixed(1)}% {tr('net margin', 'هامش صافي')}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            {tr('Dataset Summary', 'ملخص البيانات')}
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {filteredData.length} {tr('records', 'سجل')}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3 h-3" />
              <span>{tr('Print', 'طباعة')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Trend Chart for Filtered Dataset */}
      <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>{tr('Filtered Period Trend Line (Revenues vs Costs)', 'مؤشر الفترة المفلترة (الإيرادات مقابل التكاليف)')}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full" /> {tr('Revenue', 'الإيرادات')}
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-0.5 bg-rose-500 rounded-full" /> {tr('Costs', 'التكاليف')}
            </span>
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
                    €{Math.round(maxVal * frac)}
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
            {ptsRev.map((p, idx) => (
              <g key={`r-${idx}`}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" />
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
            {ptsCost.map((p, idx) => (
              <circle key={`c-${idx}`} cx={p.x} cy={p.y} r="3" fill="#f43f5e" />
            ))}
          </svg>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl bg-[#141820] border border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            {tr('Filtered Analytics Statement', 'كشف التحليلات المفلتر')}
          </h3>
          <span className="text-xs text-slate-400">
            {tr('Showing', 'عرض')} {filteredData.length}{' '}
            {tr('matched transaction items', 'سجل مطابق')}
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {tr(
              'No records match the current filter selection.',
              'لا توجد سجلات تطابق خيارات التصفية الحالية.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">{tr('Date', 'التاريخ')}</th>
                  <th className="py-3 px-4 font-semibold">{tr('Type', 'النوع')}</th>
                  <th className="py-3 px-4 font-semibold">{tr('Category', 'التصنيف')}</th>
                  <th className="py-3 px-4 font-semibold">{tr('Description', 'الوصف')}</th>
                  <th className="py-3 px-4 font-semibold">{tr('Customer', 'الزبون')}</th>
                  <th className="py-3 px-4 font-semibold">{tr('Invoice Ref', 'رقم الفاتورة')}</th>
                  <th className="py-3 px-4 font-semibold text-right">{tr('Amount', 'المبلغ')}</th>
                  {onEditTransaction && (
                    <th className="py-3 px-4 font-semibold text-right">{tr('Edit', 'تعديل')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredData.map((f) => {
                  const cust = f.customerId ? customerMap[f.customerId] : null;
                  const isInc = f.type === 'Income';

                  return (
                    <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{f.date}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isInc
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isInc ? tr('Income', 'إيراد') : tr('Expense', 'مصروف')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-300">
                        {translateCategory(f.category)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {f.description}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {cust ? `${cust.firstName} ${cust.lastName} (${cust.city})` : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {f.invoiceNumber || '—'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold text-sm tabular-nums ${
                          isInc ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isInc ? '+' : '-'}€{f.amount.toFixed(2)}
                      </td>
                      {onEditTransaction && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onEditTransaction(f)}
                            title={tr('Edit entry', 'تعديل القيد')}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
