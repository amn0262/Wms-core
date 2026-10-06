import React, { useState, useEffect } from 'react';
import { X, Check, Package, Truck, Wallet, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type {
  Customer,
  CustomerOrder,
  OrderStatus,
  OrderPaymentStatus,
  CarrierType,
} from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    order: Omit<CustomerOrder, 'id' | 'timestamp'> & { id?: number },
    syncToFinances: boolean
  ) => Promise<void>;
  customers: Customer[];
  editingOrder?: CustomerOrder | null;
  prefilledCustomerId?: number | null;
}

const CARRIERS: CarrierType[] = ['DHL', 'DPD', 'Hermes', 'GLS', 'UPS', 'Other'];
const STATUSES: OrderStatus[] = [
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  editingOrder,
  prefilledCustomerId,
}) => {
  const [customerId, setCustomerId] = useState<number>(0);
  const [orderNumber, setOrderNumber] = useState('');
  const [itemsDescription, setItemsDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<OrderPaymentStatus>('Unpaid');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<OrderStatus>('Processing');
  const [carrier, setCarrier] = useState<CarrierType>('DHL');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [syncToFinances, setSyncToFinances] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingOrder) {
      const payInfo = getOrderPaymentInfo(editingOrder);
      setCustomerId(editingOrder.customerId);
      setOrderNumber(editingOrder.orderNumber);
      setItemsDescription(editingOrder.itemsDescription || '');
      setAmount(String(editingOrder.amount || ''));
      setPaymentMode(payInfo.paymentStatus);
      setPaidAmountInput(String(payInfo.paid));
      setOrderDate(editingOrder.orderDate || new Date().toISOString().slice(0, 10));
      setStatus(editingOrder.status || 'Processing');
      setCarrier(editingOrder.carrier || 'DHL');
      setTrackingNumber(editingOrder.trackingNumber || '');
      setNotes(editingOrder.notes || '');
      setSyncToFinances(true);
    } else {
      const defaultCust = prefilledCustomerId || customers[0]?.id || 0;
      setCustomerId(defaultCust);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setOrderNumber(`ORD-2026-${randomSuffix}`);
      setItemsDescription('');
      setAmount('');
      // Default to Unpaid / Deferred or Paid based on user choice — let's default to Unpaid or Paid with clear buttons
      setPaymentMode('Unpaid');
      setPaidAmountInput('0');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setStatus('Processing');
      setCarrier('DHL');
      setTrackingNumber('');
      setNotes('');
      setSyncToFinances(true);
    }
  }, [editingOrder, prefilledCustomerId, customers, isOpen]);

  if (!isOpen) return null;

  const numOrderTotal = parseFloat(amount) || 0;
  let computedPaidAmount = 0;
  if (paymentMode === 'Paid') {
    computedPaidAmount = numOrderTotal;
  } else if (paymentMode === 'Unpaid') {
    computedPaidAmount = 0;
  } else {
    computedPaidAmount = Math.min(numOrderTotal, Math.max(0, parseFloat(paidAmountInput) || 0));
  }
  const remainingBalance = Math.max(0, numOrderTotal - computedPaidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!customerId || isNaN(numAmount) || numAmount < 0) return;

    let finalPaid = 0;
    let finalPayStatus: OrderPaymentStatus = 'Unpaid';

    if (paymentMode === 'Paid') {
      finalPaid = numAmount;
      finalPayStatus = 'Paid';
    } else if (paymentMode === 'Unpaid') {
      finalPaid = 0;
      finalPayStatus = 'Unpaid';
    } else {
      finalPaid = Math.min(numAmount, Math.max(0, parseFloat(paidAmountInput) || 0));
      if (finalPaid <= 0.01 && numAmount > 0) {
        finalPayStatus = 'Unpaid';
      } else if (finalPaid + 0.01 >= numAmount) {
        finalPaid = numAmount;
        finalPayStatus = 'Paid';
      } else {
        finalPayStatus = 'Partially Paid';
      }
    }

    const selectedCust = customers.find((c) => c.id === Number(customerId));
    const customerName = selectedCust
      ? `${selectedCust.firstName} ${selectedCust.lastName}`.trim() +
        (selectedCust.company ? ` (${selectedCust.company})` : '')
      : undefined;

    setIsSubmitting(true);
    try {
      await onSave(
        {
          id: editingOrder?.id,
          orderNumber: orderNumber.trim() || `ORD-${Date.now()}`,
          customerId: Number(customerId),
          customerName,
          itemsDescription: itemsDescription.trim() || 'Wholesale customer merchandise',
          amount: numAmount,
          paidAmount: finalPaid,
          paymentStatus: finalPayStatus,
          orderDate,
          status,
          carrier:
            status === 'Shipped' || status === 'Delivered' || trackingNumber.trim()
              ? carrier
              : undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          shippedDate:
            status === 'Shipped' || status === 'Delivered' ? orderDate : undefined,
          notes: notes.trim() || undefined,
          financeTransactionId: editingOrder?.financeTransactionId,
        },
        syncToFinances
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/15 text-rose-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingOrder ? 'Edit Customer Order & Payment Status' : 'Create Customer Order'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute order with immediate payment, partial deposit, or deferred payment (on account)
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
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Customer Account <span className="text-rose-400">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} {c.company ? `(${c.company})` : ''} — {c.city}
                </option>
              ))}
            </select>
          </div>

          {/* Order Number & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Order Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
                placeholder="e.g. ORD-2026-4402"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Order Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Order Value (€) & Fulfillment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Total Order Value (€) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-500 font-mono text-sm">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
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
                Dispatch / Order Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ============================================================== */}
          {/* PAYMENT TERMS: UNPAID (ON CREDIT) / PARTIAL / PAID IMMEDIATELY */}
          {/* ============================================================== */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                Payment Terms (طريقة الدفع عند تنفيذ الطلبية)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  paymentMode === 'Paid'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : paymentMode === 'Partially Paid'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {paymentMode === 'Paid'
                  ? 'PAID IN FULL'
                  : paymentMode === 'Partially Paid'
                  ? 'PARTIAL DEPOSIT'
                  : 'NO IMMEDIATE PAYMENT (ON ACCOUNT)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('Unpaid');
                  setPaidAmountInput('0');
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  paymentMode === 'Unpaid'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-200 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Unpaid (On Account)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  بدون دفع فوري (يُسجل دين على الزبون ويُسدد لاحقاً)
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMode('Partially Paid');
                  if (!paidAmountInput || parseFloat(paidAmountInput) <= 0) {
                    setPaidAmountInput(numOrderTotal > 0 ? (numOrderTotal / 2).toFixed(2) : '');
                  }
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  paymentMode === 'Partially Paid'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-200 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Partial Payment</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  دفعة جزئية الآن والباقي ذمم على الزبون
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMode('Paid');
                  setPaidAmountInput(String(numOrderTotal));
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  paymentMode === 'Paid'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Paid Immediately</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  مدفوع بالكامل فوراً عند إنشاء الطلبية
                </div>
              </button>
            </div>

            {paymentMode === 'Partially Paid' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-amber-300 mb-1">
                  Initial Amount Paid Now (€) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-500 font-mono text-sm">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={numOrderTotal > 0 ? numOrderTotal : undefined}
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg pl-8 pr-3.5 py-1.5 text-sm text-white font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Live Order Balance Summary Pill */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Order Value</span>
                <span className="text-white font-bold">€{numOrderTotal.toFixed(2)}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">Paid Now</span>
                <span className="text-emerald-400 font-bold">
                  +€{computedPaidAmount.toFixed(2)}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block font-sans text-[10px]">
                  Remaining on Customer
                </span>
                <span
                  className={`font-bold ${
                    remainingBalance > 0.01 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  €{remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Items Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Items / Goods Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={itemsDescription}
              onChange={(e) => setItemsDescription(e.target.value)}
              required
              placeholder="e.g. 5x Master Cartons Electronics, 20x Palletized Units"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Local Carrier & Tracking Number */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                Standard Local Parcel Carrier & Tracking
              </span>
              <span className="text-[10px] text-slate-500">
                {status === 'Shipped' || status === 'Delivered'
                  ? 'Required for shipped orders'
                  : 'Optional at processing'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Local Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as CarrierType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Tracking Number / Barcode
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 00340434190823908234"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Order Notes / Delivery Instructions <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Deferred payment agreed for 14 days, deliver to Gate 3"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
            />
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
              disabled={isSubmitting || !customerId || !amount}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-xs disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : editingOrder
                  ? 'Update Order'
                  : paymentMode === 'Unpaid'
                  ? 'Create Unpaid Order (On Account)'
                  : 'Create Order'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
