import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { Customer, Transaction, TransactionType, TransactionCategory } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => Promise<void>;
  customers: Customer[];
  prefilledCustomerId?: number | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  prefilledCustomerId,
}) => {
  const [type, setType] = useState<TransactionType>('Income');
  const [category, setCategory] = useState<TransactionCategory>('Order Revenue');
  const [customerId, setCustomerId] = useState<string>(prefilledCustomerId ? String(prefilledCustomerId) : '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prefilledCustomerId) {
      setCustomerId(String(prefilledCustomerId));
    }
  }, [prefilledCustomerId]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'Income') {
      setCategory('Order Revenue');
    } else {
      setCategory('Shipping');
    }
  };

  const isCustomerRelevant =
    type === 'Income' ||
    category === 'Shipping' ||
    category === 'Order Revenue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        type,
        category,
        description: description.trim(),
        amount: numAmount,
        date,
        customerId: customerId ? parseInt(customerId, 10) : null,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });

      // Reset
      setDescription('');
      setAmount('');
      setInvoiceNumber('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Record Transaction</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter revenue receipts, inventory purchases, or logistics costs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Transaction Type Segmented Switch */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/80 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => handleTypeChange('Income')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  type === 'Income'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Income (Revenue)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('Expense')}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  type === 'Expense'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Expense (Cost)</span>
              </button>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TransactionCategory)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              required
            >
              {type === 'Income' ? (
                <>
                  <option value="Order Revenue">Order Revenue</option>
                  <option value="Other Income">Other Income</option>
                </>
              ) : (
                <>
                  <option value="Shipping">Shipping (DHL, DPD, UPS)</option>
                  <option value="Goods/Inventory">Goods / Inventory Purchases</option>
                  <option value="Packaging & Supplies">Packaging & Supplies</option>
                  <option value="Vehicle">Vehicle & Fuel</option>
                  <option value="Warehouse Rent">Warehouse Rent & Utilities</option>
                  <option value="General">General Administrative Expense</option>
                </>
              )}
            </select>
          </div>

          {/* Customer linkage */}
          {isCustomerRelevant && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Linked Customer {type === 'Income' && <span className="text-rose-400">*</span>}
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="">-- No Specific Customer / General --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} {c.company ? `(${c.company})` : ''} - {c.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description / Product Details
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Order #8401 Pallet delivery, 20x boxes tape, DHL consignment"
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Amount (€)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  €
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-8 bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 font-mono tabular-nums focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Invoice / Reference Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Invoice / Tracking Reference <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-042 or TRK-928190"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Record Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
