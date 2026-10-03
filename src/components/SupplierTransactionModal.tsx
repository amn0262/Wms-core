import React, { useState, useEffect } from 'react';
import { X, Check, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Supplier, SupplierTransaction, SupplierTransactionType } from '../types';

interface SupplierTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<SupplierTransaction, 'id' | 'timestamp'>) => Promise<void>;
  suppliers: Supplier[];
  prefilledSupplierId?: number | null;
  defaultType?: SupplierTransactionType;
  suggestedAmount?: number;
}

export const SupplierTransactionModal: React.FC<SupplierTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  suppliers,
  prefilledSupplierId,
  defaultType = 'Bill',
  suggestedAmount,
}) => {
  const [supplierId, setSupplierId] = useState<number>(prefilledSupplierId || (suppliers[0]?.id || 0));
  const [type, setType] = useState<SupplierTransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [referenceInvoice, setReferenceInvoice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other'>('Bank Transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (prefilledSupplierId) {
      setSupplierId(prefilledSupplierId);
    } else if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id || 0);
    }
  }, [prefilledSupplierId, suppliers]);

  useEffect(() => {
    setType(defaultType);
    if (suggestedAmount && suggestedAmount > 0) {
      setAmount(suggestedAmount.toFixed(2));
    } else {
      setAmount('');
    }
    setDescription(defaultType === 'Payment' ? 'Supplier balance settlement' : '');
    setReferenceInvoice('');
  }, [defaultType, suggestedAmount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!supplierId || isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onSave({
        supplierId: Number(supplierId),
        type,
        amount: numAmount,
        date,
        description: description.trim() || (type === 'Bill' ? 'Supplier Bill / Invoice' : 'Supplier Settlement Payment'),
        referenceInvoice: referenceInvoice.trim() || undefined,
        paymentMethod: type === 'Payment' ? paymentMethod : undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === Number(supplierId));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                type === 'Bill'
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {type === 'Bill' ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {type === 'Bill' ? 'Record Supplier Bill (Invoice)' : 'Record Settlement Payment'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {type === 'Bill'
                  ? 'Increases accounts payable balance (money owed to supplier)'
                  : 'Reduces accounts payable balance / settles supplier debt'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Transaction Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Entry Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setType('Bill')}
                className={`py-2 px-3 rounded-md font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'Bill'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Supplier Bill (We Owe)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('Payment')}
                className={`py-2 px-3 rounded-md font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'Payment'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Payment Sent (We Paid)</span>
              </button>
            </div>
          </div>

          {/* Supplier Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Supplier <span className="text-rose-400">*</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Amount (€) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-500 font-mono text-sm">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description / Items Details
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'Bill'
                  ? 'e.g. 500x shipping boxes & bubble wrap roll'
                  : 'e.g. Bank wire transfer for Invoice #4409'
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Reference Invoice # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Invoice / Reference # <span className="text-slate-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={referenceInvoice}
                onChange={(e) => setReferenceInvoice(e.target.value)}
                placeholder="e.g. RE-2026-9021"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {type === 'Payment' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Bank Transfer">Bank Transfer (SEPA)</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 w-full">
                  Vendor: <span className="font-semibold text-slate-200">{selectedSupplier?.name || 'Selected'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs ${
                type === 'Bill'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : type === 'Bill' ? 'Post Supplier Bill' : 'Confirm Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
