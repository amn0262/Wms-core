import React, { useState, useEffect } from 'react';
import { X, Check, Truck, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import type { CustomerOrder, CarrierType } from '../types';

interface ShipOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CustomerOrder | null;
  onSaveShipment: (orderId: number, carrier: CarrierType, trackingNumber: string, shippedDate: string) => Promise<void>;
}

const CARRIERS: CarrierType[] = ['DHL', 'DPD', 'Hermes', 'GLS', 'UPS', 'Other'];

export const ShipOrderModal: React.FC<ShipOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSaveShipment,
}) => {
  const [carrier, setCarrier] = useState<CarrierType>('DHL');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setCarrier(order.carrier || 'DHL');
      setTrackingNumber(order.trackingNumber || '');
      setShippedDate(order.shippedDate || new Date().toISOString().slice(0, 10));
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order.id || !trackingNumber.trim()) return;

    setIsSubmitting(true);
    try {
      await onSaveShipment(order.id, carrier, trackingNumber.trim(), shippedDate);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {order.status === 'Shipped' ? 'Update Tracking Details' : 'Dispatch & Mark as Shipped'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Order <strong className="text-slate-200">{order.orderNumber}</strong> · {order.customerName}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Carrier Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Carrier / Shipping Provider <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CARRIERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarrier(c)}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    carrier === c
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Number Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Carrier Tracking Number / Waybill ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
              placeholder="e.g. 00340434190823908234 or 1Z9999999999999999"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500 font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Enter the package barcode or carrier tracking code to enable direct shipment tracing.
            </p>
          </div>

          {/* Shipped Date */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Dispatch / Handover Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={shippedDate}
              onChange={(e) => setShippedDate(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500"
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
              disabled={isSubmitting || !trackingNumber.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Updating...' : 'Confirm Shipment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
