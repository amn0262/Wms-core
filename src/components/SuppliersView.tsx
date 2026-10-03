import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Phone,
  Mail,
  Scale,
  BookOpen,
} from 'lucide-react';
import type { Supplier, SupplierTransaction } from '../types';
import { SupplierLedgerModal } from './SupplierLedgerModal';

interface SuppliersViewProps {
  suppliers: Supplier[];
  supplierTransactions: SupplierTransaction[];
  onOpenSupplierModal: (supplierToEdit?: Supplier) => void;
  onOpenTransactionModal: (supplierId?: number, defaultType?: 'Bill' | 'Payment', suggestedAmount?: number) => void;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBT' | 'CREDIT' | 'SETTLED'>('ALL');
  const [sortBy, setSortBy] = useState<'debt' | 'name' | 'bills' | 'payments'>('debt');
  const [activeLedgerSupplier, setActiveLedgerSupplier] = useState<Supplier | null>(null);

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

  // Filtered & sorted supplier list (No category filtering needed, all are goods suppliers)
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

        if (sortBy === 'debt') return balB - balA; // Highest debt first
        if (sortBy === 'bills') return billsB - billsA;
        if (sortBy === 'payments') return payB - payA;
        return a.name.localeCompare(b.name);
      });
  }, [suppliers, searchTerm, statusFilter, sortBy, supplierBalances]);

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Debt (Accounts Payable) */}
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

        {/* Total Supplier Surplus / Advance Credits */}
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

        {/* Net Supplier Exposure */}
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

        {/* Total Historical Volume */}
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

      {/* 2. CONTROLS, SEARCH & ACTIONS */}
      <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search merchandise suppliers by company name, contact person, or notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
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

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Status Financial Filters */}
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

          {/* Sort controls */}
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
      </div>

      {/* 3. SUPPLIER LIST / TABLE */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#141820] border border-slate-800 text-slate-400 space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Goods Suppliers Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'No suppliers match your current filter query. Try clearing filters.'
              : 'Add your merchandise & inventory suppliers to manage delivery bills, settlement payments, and live accounts payable balances.'}
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
                  <tr
                    key={supplier.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Supplier Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">
                        {supplier.name}
                      </div>
                      {supplier.notes && (
                        <div className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5" title={supplier.notes}>
                          {supplier.notes}
                        </div>
                      )}
                    </td>

                    {/* Contact Person */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="font-medium text-slate-200">{supplier.contactPerson || '—'}</div>
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

                    {/* Total Invoiced */}
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-200">
                      €{(stat?.totalBills || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Total Paid */}
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-400">
                      €{(stat?.totalPayments || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Account Balance */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                      <div
                        className={`text-sm ${
                          isDebt ? 'text-rose-400' : isCredit ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        €{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {isDebt ? 'We owe' : isCredit ? 'Surplus credit' : 'Balanced'}
                      </div>
                    </td>

                    {/* Status Badge */}
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

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Statement / Ledger */}
                        <button
                          onClick={() => setActiveLedgerSupplier(supplier)}
                          title="View Statement of Account / Ledger"
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                          <span>Ledger</span>
                        </button>

                        {/* Quick Settle / Pay */}
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

                        {/* Quick Bill */}
                        <button
                          onClick={() => supplier.id && onOpenTransactionModal(supplier.id, 'Bill')}
                          title="Record new bill"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onOpenSupplierModal(supplier)}
                          title="Edit supplier"
                          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (supplier.id && window.confirm(`Delete supplier "${supplier.name}"?`)) {
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
        onDeleteTransaction={onDeleteTransaction}
      />
    </div>
  );
};
