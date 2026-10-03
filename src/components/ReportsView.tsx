import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { exportTransactionsToCSV } from '../utils/csvExport';

interface ReportsViewProps {
  transactions: Transaction[];
  customers: Customer[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  customers,
}) => {
  const [timePreset, setTimePreset] = useState<
    'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  >('month');
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
    // Normalize today
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
    return transactions.filter((t) => {
      if (!isDateInRange(t.date)) return false;
      if (selectedCustomerId !== 'all' && String(t.customerId) !== selectedCustomerId) {
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
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
            <span>Multi-Variable Filters</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Time Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Time Period
            </label>
            <select
              value={timePreset}
              onChange={(e) => setTimePreset(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Recorded History</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Calendar Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Client Account
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Clients & Operations</option>
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
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Categories</option>
              <option value="Order Revenue">Order Revenue</option>
              <option value="Shipping">Shipping</option>
              <option value="Goods/Inventory">Goods / Inventory</option>
              <option value="Packaging & Supplies">Packaging & Supplies</option>
              <option value="Vehicle">Vehicle & Fuel</option>
              <option value="Warehouse Rent">Warehouse Rent</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Product / Keyword Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Pallet, DHL, Nike, Boxes..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Custom Date Pickers (if selected) */}
        {timePreset === 'custom' && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Start Date
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
                End Date
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
            Filtered Revenue
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            €{filteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredData.filter((d) => d.type === 'Income').length} income entries
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            Filtered Costs
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            €{filteredCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {filteredData.filter((d) => d.type === 'Expense').length} cost entries
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            Filtered Net Margin
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              filteredNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            €{filteredNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {marginPercent.toFixed(1)}% net margin
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="text-xs text-slate-400 uppercase font-semibold mb-1">
            Dataset Summary
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {filteredData.length} records
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Printer className="w-3 h-3" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-xl bg-[#141820] border border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Filtered Analytics Statement</h3>
          <span className="text-xs text-slate-400">
            Showing {filteredData.length} matched transaction items
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No records match the current filter selection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Invoice Ref</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
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
                          {f.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-300">
                        {f.category}
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
