import React, { useState, useEffect } from 'react';
import { X, Check, Truck, Package, Layers, Receipt, Building2 } from 'lucide-react';
import type {
  Customer,
  Transaction,
  TransactionType,
  TransactionCategory,
  CarrierType,
} from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    transaction: Omit<Transaction, 'id' | 'timestamp'> & { id?: number }
  ) => Promise<void>;
  customers: Customer[];
  prefilledCustomerId?: number | null;
  editingTransaction?: Transaction | null;
  defaultCategory?: TransactionCategory | null;
}

const LOCAL_CARRIERS: CarrierType[] = ['DHL', 'DPD', 'Hermes', 'GLS', 'UPS', 'Other'];
const PACKAGING_TYPES = [
  'Carton Shipping Boxes',
  'Heavy-Duty Packing Tape',
  'Bubble Wrap & Protective Fillers',
  'Stretch Film & Pallet Wrap',
  'Shipping Labels & Pouches',
  'Mixed Packaging Supplies',
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  prefilledCustomerId,
  editingTransaction,
  defaultCategory,
}) => {
  const [type, setType] = useState<TransactionType>('Income');
  const [category, setCategory] = useState<TransactionCategory>('Order Revenue');
  const [customerId, setCustomerId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Dynamic context-specific fields
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierType>('DHL');
  const [packagingType, setPackagingType] = useState<string>(PACKAGING_TYPES[0]);
  const [batchQuantity, setBatchQuantity] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      setCustomerId(
        editingTransaction.customerId ? String(editingTransaction.customerId) : ''
      );
      setDescription(editingTransaction.description || '');
      setAmount(String(editingTransaction.amount || ''));
      setDate(editingTransaction.date || new Date().toISOString().split('T')[0]);
      setInvoiceNumber(editingTransaction.invoiceNumber || '');

      // Detect carrier if shipping
      const lowerDesc = (editingTransaction.description || '').toLowerCase();
      if (lowerDesc.includes('dpd')) setSelectedCarrier('DPD');
      else if (lowerDesc.includes('hermes')) setSelectedCarrier('Hermes');
      else if (lowerDesc.includes('gls')) setSelectedCarrier('GLS');
      else if (lowerDesc.includes('ups')) setSelectedCarrier('UPS');
      else setSelectedCarrier('DHL');

      setBatchQuantity('');
      setVendorName('');
    } else {
      if (defaultCategory) {
        const isInc =
          defaultCategory === 'Order Revenue' || defaultCategory === 'Other Income';
        setType(isInc ? 'Income' : 'Expense');
        setCategory(defaultCategory);
      } else {
        setType('Income');
        setCategory('Order Revenue');
      }
      setCustomerId(prefilledCustomerId ? String(prefilledCustomerId) : '');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setInvoiceNumber('');
      setSelectedCarrier('DHL');
      setPackagingType(PACKAGING_TYPES[0]);
      setBatchQuantity('');
      setVendorName('');
    }
  }, [isOpen, editingTransaction, prefilledCustomerId, defaultCategory]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'Income') {
      setCategory('Order Revenue');
    } else {
      setCategory('Shipping');
    }
  };

  const handleQuickPreset = (presetCat: TransactionCategory) => {
    if (presetCat === 'Order Revenue' || presetCat === 'Other Income') {
      setType('Income');
      setCategory(presetCat);
    } else {
      setType('Expense');
      setCategory(presetCat);
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

    let finalDescription = description.trim();

    // Enrich description dynamically based on entry type if creating or updating
    if (category === 'Shipping') {
      const lower = finalDescription.toLowerCase();
      const carrierLower = selectedCarrier.toLowerCase();
      if (!lower.includes(carrierLower)) {
        finalDescription = `${selectedCarrier} Local Parcel — ${finalDescription || 'Standard dispatch'}`;
      }
    } else if (category === 'Packaging & Supplies' && !editingTransaction) {
      const parts: string[] = [];
      if (packagingType && !finalDescription.toLowerCase().includes(packagingType.toLowerCase().split(' ')[0])) {
        parts.push(packagingType);
      }
      if (batchQuantity.trim()) {
        parts.push(`(${batchQuantity.trim()})`);
      }
      if (finalDescription) {
        parts.push(`— ${finalDescription}`);
      }
      finalDescription = parts.join(' ') || 'Packaging & warehouse supplies batch';
    } else if (category === 'Goods/Inventory' && vendorName.trim() && !editingTransaction) {
      finalDescription = `${vendorName.trim()} — ${finalDescription || 'Merchandise restock'}`;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingTransaction?.id,
        type,
        category,
        description: finalDescription || `${category} entry`,
        amount: numAmount,
        date,
        customerId: customerId ? parseInt(customerId, 10) : null,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });

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
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/15 text-rose-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingTransaction ? 'Edit Ledger Entry' : 'Record Operation / Ledger Entry'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fields adapt dynamically to the selected operation category
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Quick Operation Type Selector Pills */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Operation Category (Select to adapt fields)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('Order Revenue')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'Order Revenue'
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Order Revenue</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('Shipping')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'Shipping'
                    ? 'bg-sky-600/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">Local Shipping</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('Packaging & Supplies')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'Packaging & Supplies'
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Packaging Buy</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('Goods/Inventory')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'Goods/Inventory'
                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">Goods Purchase</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPreset('Vehicle')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                  category === 'Vehicle' || category === 'Warehouse Rent' || category === 'General'
                    ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Facility / Other</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange(type === 'Income' ? 'Expense' : 'Income')}
                className="px-2.5 py-2 rounded-lg text-[11px] font-mono border bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 text-center cursor-pointer"
              >
                Type: <strong className={type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}>{type}</strong>
              </button>
            </div>
          </div>

          {/* Full Category Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ledger Direction
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as TransactionType)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Income">Income (Revenue Inflow +€)</option>
                <option value="Expense">Expense (Cost Outflow -€)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Exact Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                required
              >
                {type === 'Income' ? (
                  <>
                    <option value="Order Revenue">Order Revenue</option>
                    <option value="Other Income">Other Income</option>
                  </>
                ) : (
                  <>
                    <option value="Shipping">Standard Local Shipping (DHL, DPD, Hermes, GLS, UPS)</option>
                    <option value="Packaging & Supplies">Packaging & Supplies Purchase</option>
                    <option value="Goods/Inventory">Goods / Inventory Purchase</option>
                    <option value="Vehicle">Vehicle & Fuel</option>
                    <option value="Warehouse Rent">Warehouse Rent & Utilities</option>
                    <option value="General">General Administrative Expense</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* DYNAMIC FIELDS FOR LOCAL PARCEL SHIPPING */}
          {category === 'Shipping' && (
            <div className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Standard Local Parcel Carrier Details
                </span>
                <span className="text-[10px] font-mono text-sky-400/80">Ground Shipping Only</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                {LOCAL_CARRIERS.map((car) => (
                  <button
                    key={car}
                    type="button"
                    onClick={() => setSelectedCarrier(car)}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono font-bold border transition-all cursor-pointer ${
                      selectedCarrier === car
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {car}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS FOR PACKAGING & SUPPLIES */}
          {category === 'Packaging & Supplies' && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Packaging & Supplies Specifications
                </span>
                <span className="text-[10px] font-mono text-purple-400/80">Bay D4 Stock</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Material Type</label>
                  <select
                    value={packagingType}
                    onChange={(e) => setPackagingType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {PACKAGING_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    Batch Quantity / Units
                  </label>
                  <input
                    type="text"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    placeholder="e.g. 500x cartons, 40 rolls"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC FIELDS FOR GOODS / INVENTORY */}
          {category === 'Goods/Inventory' && (
            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Direct Merchandise / Inventory Purchase
                </span>
                <span className="text-[10px] font-mono text-rose-400/80">Bay A1 Inbound</span>
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">
                  Vendor / Supplier Name <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Wholesale Supplier A"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Customer linkage */}
          {isCustomerRelevant && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Linked Customer Account {type === 'Income' && <span className="text-rose-400">*</span>}
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="">-- No Specific Customer / General --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} {c.company ? `(${c.company})` : ''} — {c.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description / Operation Details <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                category === 'Shipping'
                  ? 'e.g. 3x Local Parcel Boxes to Berlin (#ORD-8401)'
                  : category === 'Packaging & Supplies'
                  ? 'e.g. Double-wall shipping cartons 60x40x40cm'
                  : category === 'Goods/Inventory'
                  ? 'e.g. 200 units Footwear & Apparel restock'
                  : 'e.g. Wholesale order #8401 or operational expense'
              }
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Amount (€) <span className="text-rose-400">*</span>
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
                  className="w-full pl-8 bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 font-mono tabular-nums focus:outline-none focus:border-rose-500 font-bold"
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

          {/* Invoice / Tracking Reference Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {category === 'Shipping'
                ? 'Waybill / Local Tracking Number'
                : 'Invoice / Reference Number'}{' '}
              <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={
                category === 'Shipping'
                  ? 'e.g. 00340434190823908234 or EXP-DHL-1092'
                  : 'e.g. INV-2026-042 or PKG-1184'
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || !amount}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : editingTransaction
                  ? 'Update Entry'
                  : 'Save Entry'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
