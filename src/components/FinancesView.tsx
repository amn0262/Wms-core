import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import type { Customer, Transaction, TransactionType, TransactionCategory } from '../types';
import { exportTransactionsToCSV } from '../utils/csvExport';

interface FinancesViewProps {
  transactions: Transaction[];
  customers: Customer[];
  onOpenTransactionModal: () => void;
  onDeleteTransaction: (id: number) => Promise<void>;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  transactions,
  customers,
  onOpenTransactionModal,
  onDeleteTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const customerMap = useMemo(() => {
    const map: Record<number, Customer> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [customers]);

  // Financial summary
  const summary = useMemo(() => {
    let inc = 0;
    let exp = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Income') inc += amt;
      else exp += amt;
    });
    return {
      income: inc,
      expense: exp,
      net: inc - exp,
      count: transactions.length,
    };
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        // Type filter
        if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
        // Category filter
        if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const desc = t.description.toLowerCase();
          const inv = (t.invoiceNumber || '').toLowerCase();
          const cust = t.customerId ? customerMap[t.customerId] : null;
          const custName = cust
            ? `${cust.firstName} ${cust.lastName} ${cust.company || ''}`.toLowerCase()
            : '';

          return desc.includes(q) || inv.includes(q) || custName.includes(q);
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, typeFilter, categoryFilter, searchTerm, customerMap]);

  const handleExportCSV = () => {
    exportTransactionsToCSV(filtered, customerMap, `Finances_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">Total Income</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            €{summary.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">Total Expenses</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
            €{summary.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">Net Operating Balance</span>
            <Receipt className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              summary.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            €{summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">Total Ledger Records</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {summary.count} entries
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search description, invoice, or client..."
            className="w-full pl-9 pr-4 py-2 bg-[#141820] border border-slate-800 rounded-lg text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Segmented */}
          <div className="flex items-center gap-1 p-1 bg-[#141820] border border-slate-800 rounded-lg text-xs">
            {(['ALL', 'Income', 'Expense'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#141820] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Order Revenue">Order Revenue</option>
            <option value="Shipping">Shipping</option>
            <option value="Goods/Inventory">Goods / Inventory</option>
            <option value="Packaging & Supplies">Packaging & Supplies</option>
            <option value="Vehicle">Vehicle & Fuel</option>
            <option value="Warehouse Rent">Warehouse Rent</option>
            <option value="General">General Administrative</option>
          </select>

          {/* Export & New */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenTransactionModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl bg-[#141820] border border-slate-800 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No financial entries found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type & Category</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Customer Account</th>
                  <th className="py-3 px-4 font-semibold">Ref / Invoice</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((t) => {
                  const cust = t.customerId ? customerMap[t.customerId] : null;
                  const isInc = t.type === 'Income';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{t.date}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isInc
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {t.type}
                          </span>
                          <span className="text-slate-300 font-medium text-xs">
                            {t.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {t.description}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {cust ? (
                          <div>
                            <div className="font-semibold text-slate-200">
                              {cust.firstName} {cust.lastName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {cust.city}, {cust.country}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {t.invoiceNumber || '—'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold text-sm tabular-nums ${
                          isInc ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isInc ? '+' : '-'}€{t.amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (t.id && window.confirm(`Delete transaction "${t.description}"?`)) {
                              onDeleteTransaction(t.id);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
