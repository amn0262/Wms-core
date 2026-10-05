import React, { useMemo } from 'react';
import {
  X,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Trash2,
  FileSpreadsheet,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Edit2,
} from 'lucide-react';
import type { Supplier, SupplierTransaction } from '../types';

interface SupplierLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  transactions: SupplierTransaction[];
  onOpenNewTransaction: (supplierId: number, defaultType: 'Bill' | 'Payment', suggestedAmount?: number) => void;
  onEditTransaction?: (tx: SupplierTransaction) => void;
  onDeleteTransaction: (id: number) => Promise<void>;
}

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  isOpen,
  onClose,
  supplier,
  transactions,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  if (!isOpen || !supplier) return null;

  // Filter transactions for this supplier and sort chronologically for running balance
  const { sortedEntries, totalBills, totalPayments, currentBalance } = useMemo(() => {
    const list = transactions
      .filter((t) => t.supplierId === supplier.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.timestamp - b.timestamp);

    let bills = 0;
    let payments = 0;
    let running = 0;

    const entriesWithBalance = list.map((item) => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'Bill') {
        bills += amt;
        running += amt; // Positive = debt owed
      } else {
        payments += amt;
        running -= amt;
      }
      return {
        ...item,
        runningBalance: running,
      };
    });

    // Reverse for display (newest first)
    return {
      sortedEntries: [...entriesWithBalance].reverse(),
      totalBills: bills,
      totalPayments: payments,
      currentBalance: bills - payments,
    };
  }, [transactions, supplier]);

  // Export ledger to CSV
  const handleExportCSV = () => {
    if (sortedEntries.length === 0) return;

    const headers = [
      'Date',
      'Transaction Type',
      'Description',
      'Reference / Invoice #',
      'Bill (Billed by Supplier)',
      'Payment (Paid to Supplier)',
      'Running Balance',
      'Payment Method',
    ];

    const rows = [...sortedEntries].reverse().map((t) => [
      t.date,
      t.type,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.referenceInvoice || '').replace(/"/g, '""')}"`,
      t.type === 'Bill' ? t.amount.toFixed(2) : '0.00',
      t.type === 'Payment' ? t.amount.toFixed(2) : '0.00',
      t.runningBalance.toFixed(2),
      t.paymentMethod || '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Supplier_Statement_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isDebt = currentBalance > 0.01;
  const isCredit = currentBalance < -0.01;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-600/15 text-rose-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{supplier.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Goods Supplier
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                {supplier.contactPerson && (
                  <span>Contact: <strong className="text-slate-200">{supplier.contactPerson}</strong></span>
                )}
                {supplier.phone && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {supplier.phone}
                  </span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {supplier.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              title="Export Statement to CSV"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Account Balance Summary Cards */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Invoiced */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">
                Total Invoiced (Bills)
              </span>
              <div className="text-lg font-bold font-mono text-white mt-1">
                €{totalBills.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Total goods & services charged
              </span>
            </div>

            {/* Total Paid */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">
                Total Settled (Payments)
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                €{totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Total payments sent to date
              </span>
            </div>

            {/* Current Net Balance */}
            <div
              className={`p-4 rounded-xl border ${
                isDebt
                  ? 'bg-rose-950/30 border-rose-800/50'
                  : isCredit
                  ? 'bg-emerald-950/30 border-emerald-800/50'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">
                  Current Account Balance
                </span>
                {isDebt ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    <AlertCircle className="w-3 h-3" /> Debt (We Owe)
                  </span>
                ) : isCredit ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Surplus (Credit)
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">Settled</span>
                )}
              </div>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  isDebt ? 'text-rose-400' : isCredit ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                €{Math.abs(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isDebt
                  ? 'Outstanding payable due to this supplier'
                  : isCredit
                  ? 'Overpayment or advance credit with supplier'
                  : 'All invoices are fully settled'}
              </span>
            </div>
          </div>

          {/* Quick Transaction Action Buttons */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60">
            <span className="text-xs text-slate-400 font-medium">
              Record new ledger entry:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => supplier.id && onOpenNewTransaction(supplier.id, 'Bill')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 transition-colors cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>+ Post New Bill</span>
              </button>

              <button
                onClick={() =>
                  supplier.id &&
                  onOpenNewTransaction(
                    supplier.id,
                    'Payment',
                    isDebt ? currentBalance : undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{isDebt ? `Settle Debt (€${currentBalance.toFixed(2)})` : '+ Send Payment'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Statement of Account ({sortedEntries.length} entries)
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Newest records on top
            </span>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
              No bills or payments recorded for this supplier yet. Click "+ Post New Bill" or "+ Send Payment" above.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description & Reference</th>
                    <th className="py-3 px-4 text-right">Bill (Debt +)</th>
                    <th className="py-3 px-4 text-right">Payment (Paid -)</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sortedEntries.map((item) => {
                    const isBill = item.type === 'Bill';
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isBill
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isBill ? (
                              <>
                                <ArrowDownLeft className="w-3 h-3" /> Bill
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3 h-3" /> Payment
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{item.description}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {item.referenceInvoice && (
                              <span className="font-mono text-slate-300">
                                Ref: {item.referenceInvoice}
                              </span>
                            )}
                            {item.paymentMethod && (
                              <span className="text-slate-500">· {item.paymentMethod}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-rose-400 whitespace-nowrap">
                          {isBill ? `€${item.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-400 whitespace-nowrap">
                          {!isBill ? `€${item.amount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              item.runningBalance > 0.01
                                ? 'text-rose-400'
                                : item.runningBalance < -0.01
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }
                          >
                            €{item.runningBalance.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {onEditTransaction && (
                              <button
                                onClick={() => onEditTransaction(item)}
                                title="Edit entry"
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (item.id && window.confirm('Delete this ledger entry?')) {
                                  onDeleteTransaction(item.id);
                                }
                              }}
                              title="Delete entry"
                              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );
};
