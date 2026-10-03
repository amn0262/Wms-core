import React, { useState, useEffect } from 'react';
import { X, Check, Package, Building2, Truck } from 'lucide-react';
import type { Customer, CustomerOrder, OrderStatus, CarrierType } from '../types';

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

const CARRIERS: CarrierType[] = ['DHL', 'DPD', 'UPS', 'GLS', 'Hermes', 'Spedition', 'Other'];
const STATUSES: OrderStatus[] = ['Processing', 'Ready for Dispatch', 'Shipped', 'Delivered', 'Cancelled'];

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
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<OrderStatus>('Processing');
  const [carrier, setCarrier] = useState<CarrierType>('DHL');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [syncToFinances, setSyncToFinances] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setCustomerId(editingOrder.customerId);
      setOrderNumber(editingOrder.orderNumber);
      setItemsDescription(editingOrder.itemsDescription || '');
      setAmount(String(editingOrder.amount || ''));
      setOrderDate(editingOrder.orderDate || new Date().toISOString().slice(0, 10));
      setStatus(editingOrder.status || 'Processing');
      setCarrier(editingOrder.carrier || 'DHL');
      setTrackingNumber(editingOrder.trackingNumber || '');
      setNotes(editingOrder.notes || '');
      setSyncToFinances(false); // don't duplicate finance entry on edit
    } else {
      const defaultCust = prefilledCustomerId || (customers[0]?.id || 0);
      setCustomerId(defaultCust);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setOrderNumber(`ORD-2026-${randomSuffix}`);
      setItemsDescription('');
      setAmount('');
      setOrderDate(new Date().toISOString().slice(0, 10));
      setStatus('Processing');
      setCarrier('DHL');
      setTrackingNumber('');
      setNotes('');
      setSyncToFinances(true);
    }
  }, [editingOrder, prefilledCustomerId, customers, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!customerId || isNaN(numAmount) || numAmount < 0) return;

    const selectedCust = customers.find((c) => c.id === Number(customerId));
    const customerName = selectedCust
      ? `${selectedCust.firstName} ${selectedCust.lastName}`.trim() + (selectedCust.company ? ` (${selectedCust.company})` : '')
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
          orderDate,
          status,
          carrier: status === 'Shipped' || status === 'Delivered' || trackingNumber.trim() ? carrier : undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          shippedDate: status === 'Shipped' || status === 'Delivered' ? orderDate : undefined,
          notes: notes.trim() || undefined,
          financeTransactionId: editingOrder?.financeTransactionId,
        },
        syncToFinances && !editingOrder
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
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/15 text-rose-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingOrder ? 'Edit Customer Order' : 'Create Customer Order'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Consignment fulfillment, customer link, tracking number & delivery status
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

          {/* Order Value (€) & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Order Value (€) <span className="text-rose-400">*</span>
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
                Order Status <span className="text-rose-400">*</span>
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

          {/* Carrier & Tracking Number (Highlight if Shipped) */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                Shipping & Tracking Details
              </span>
              <span className="text-[10px] text-slate-500">
                {status === 'Shipped' || status === 'Delivered' ? 'Required for shipped orders' : 'Optional at processing'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Carrier</label>
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

          {/* Auto Sync to Financial Ledger */}
          {!editingOrder && (
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncToFinances}
                onChange={(e) => setSyncToFinances(e.target.checked)}
                className="rounded border-slate-700 text-rose-600 focus:ring-0"
              />
              <span>Automatically post this order revenue to Income & Expenses Ledger</span>
            </label>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Order Notes / Delivery Instructions <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Gate 3 loading dock, call before arrival"
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
              disabled={isSubmitting || !itemsDescription.trim() || !amount}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : editingOrder ? 'Update Order' : 'Create Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
