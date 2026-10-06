import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Truck,
  Package,
  Layers,
  Receipt,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Link2,
} from 'lucide-react';
import type {
  Customer,
  Transaction,
  TransactionType,
  TransactionCategory,
  CarrierType,
  CustomerOrder,
  Supplier,
  SupplierTransactionType,
} from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

export interface UnifiedTransactionExtraActions {
  // 1. If Income -> Customer Payment is recorded, settle customer balance / unpaid order
  customerPaymentSettlement?: {
    customerId: number;
    orderId: number | null;
    amount: number;
    date: string;
    paymentMethod: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
    description: string;
    referenceInvoice?: string;
  };
  // 2. If Expense -> Shipping is linked to an Order, optionally mark order shipped & attach tracking
  shipmentOrderUpdate?: {
    orderId: number;
    carrier: CarrierType;
    trackingNumber: string;
    shippedDate: string;
  };
  // 3. If Expense -> Goods/Inventory is linked to a Supplier, sync with Supplier Ledger
  supplierLedgerEntry?: {
    supplierId: number;
    type: SupplierTransactionType;
    amount: number;
    date: string;
    description: string;
    referenceInvoice?: string;
    paymentMethod?: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
    recordInCashFinances: boolean; // False if bought on credit (Bill), True if paid now
  };
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    transaction: Omit<Transaction, 'id' | 'timestamp'> & { id?: number },
    extraActions?: UnifiedTransactionExtraActions
  ) => Promise<void>;
  customers: Customer[];
  orders?: CustomerOrder[];
  suppliers?: Supplier[];
  prefilledCustomerId?: number | null;
  editingTransaction?: Transaction | null;
  defaultCategory?: TransactionCategory | null;
}

const LOCAL_CARRIERS: CarrierType[] = ['DHL', 'DPD', 'Hermes', 'GLS', 'UPS', 'Other'];

const PACKAGING_TYPES = [
  'Carton Shipping Boxes (صناديق وشحن كرتون)',
  'Heavy-Duty Packing Tape (شريط لاصق مقوى)',
  'Bubble Wrap & Protective Fillers (نايلون فقاعات وحشوات حماية)',
  'Stretch Film & Pallet Wrap (رول تغليف طبليات سترتش)',
  'Shipping Labels & Pouches (ملصقات شحن وأظرف بوليصة)',
  'Mixed Packaging Supplies (مستلزمات تغليف متنوعة)',
];

const PERSONAL_WITHDRAWAL_REASONS = [
  'Personal Living & Household Draw (سحب مصروف شخصي / منزلي)',
  'Owner Monthly Profit Draw (سحب أرباح خاصة للمالك)',
  'Personal Cash Withdrawal (سحب نقدي للاستخدام الشخصي)',
  'Owner Emergency / Miscellaneous Personal Use (سحب طوارئ واستخدام خاص)',
];

const OWNER_INJECTION_SOURCES = [
  'Owner Personal Funds Injection (إيداع من المال الخاص لدعم السيولة)',
  'Personal Bank Transfer to Business (تحويل من الحساب الشخصي لحساب العمل)',
  'Cash Capital Deposit by Owner (إيداع نقدي خاص في الصندوق)',
  'Owner Supplier/Shipping Coverage from Personal Funds (تغطية مشتريات أو شحن من المال الخاص)',
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  orders = [],
  suppliers = [],
  prefilledCustomerId,
  editingTransaction,
  defaultCategory,
}) => {
  const { tr } = useI18n();

  // Main 2 Tabs: 'Income' (إيراد) | 'Expense' (مصروف)
  const [type, setType] = useState<TransactionType>('Income');

  // Dropdown 1: Category (نوع القيد)
  const [category, setCategory] = useState<TransactionCategory>('Customer Payment');

  // Cascading Dropdown 2 & 3 States
  const [customerId, setCustomerId] = useState<string>('');
  const [linkedOrderId, setLinkedOrderId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierActionMode, setSupplierActionMode] = useState<
    'DIRECT_CASH' | 'SUPPLIER_PAYMENT' | 'SUPPLIER_CREDIT_BILL'
  >('SUPPLIER_PAYMENT');

  const [selectedCarrier, setSelectedCarrier] = useState<CarrierType>('DHL');
  const [updateOrderToShipped, setUpdateOrderToShipped] = useState<boolean>(true);
  const [packagingType, setPackagingType] = useState<string>(PACKAGING_TYPES[0]);
  const [batchQuantity, setBatchQuantity] = useState<string>('');
  const [personalReason, setPersonalReason] = useState<string>(PERSONAL_WITHDRAWAL_REASONS[0]);
  const [injectionSource, setInjectionSource] = useState<string>(OWNER_INJECTION_SOURCES[0]);

  // Common Fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other'
  >('Cash');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter orders for the selected customer
  const customerOrders = useMemo(() => {
    if (!customerId) return [];
    const cId = parseInt(customerId, 10);
    return orders.filter((o) => o.customerId === cId && o.status !== 'Cancelled');
  }, [orders, customerId]);

  // Filter unpaid/partially paid orders for customer payment
  const unpaidCustomerOrders = useMemo(() => {
    return customerOrders.filter((o) => getOrderPaymentInfo(o).remaining > 0.01);
  }, [customerOrders]);

  // Total customer unpaid balance
  const selectedCustomerDebt = useMemo(() => {
    return unpaidCustomerOrders.reduce(
      (sum, o) => sum + getOrderPaymentInfo(o).remaining,
      0
    );
  }, [unpaidCustomerOrders]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      setCustomerId(
        editingTransaction.customerId ? String(editingTransaction.customerId) : ''
      );
      setLinkedOrderId(
        editingTransaction.orderId ? String(editingTransaction.orderId) : ''
      );
      setDescription(editingTransaction.description || '');
      setAmount(String(editingTransaction.amount || ''));
      setDate(editingTransaction.date || new Date().toISOString().split('T')[0]);
      setInvoiceNumber(editingTransaction.invoiceNumber || '');
      setPaymentMethod(editingTransaction.paymentMethod || 'Cash');

      const lowerDesc = (editingTransaction.description || '').toLowerCase();
      if (lowerDesc.includes('dpd')) setSelectedCarrier('DPD');
      else if (lowerDesc.includes('hermes')) setSelectedCarrier('Hermes');
      else if (lowerDesc.includes('gls')) setSelectedCarrier('GLS');
      else if (lowerDesc.includes('ups')) setSelectedCarrier('UPS');
      else setSelectedCarrier('DHL');

      setSupplierId('');
      setBatchQuantity('');
    } else {
      if (defaultCategory) {
        const isInc =
          defaultCategory === 'Order Revenue' ||
          defaultCategory === 'Customer Payment' ||
          defaultCategory === 'Owner Capital Injection' ||
          defaultCategory === 'Other Income';
        setType(isInc ? 'Income' : 'Expense');
        setCategory(defaultCategory);
      } else {
        setType('Income');
        setCategory('Customer Payment');
      }
      setCustomerId(prefilledCustomerId ? String(prefilledCustomerId) : '');
      setLinkedOrderId('');
      setSupplierId(suppliers[0]?.id ? String(suppliers[0].id) : '');
      setSupplierActionMode('SUPPLIER_PAYMENT');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setInvoiceNumber('');
      setPaymentMethod('Cash');
      setSelectedCarrier('DHL');
      setUpdateOrderToShipped(true);
      setPackagingType(PACKAGING_TYPES[0]);
      setBatchQuantity('');
      setPersonalReason(PERSONAL_WITHDRAWAL_REASONS[0]);
      setInjectionSource(OWNER_INJECTION_SOURCES[0]);
    }
  }, [isOpen, editingTransaction, prefilledCustomerId, defaultCategory, suppliers]);

  // Auto-fill amount when choosing an unpaid order in Customer Payment
  const handleSelectLinkedOrder = (orderIdStr: string) => {
    setLinkedOrderId(orderIdStr);
    if (!orderIdStr) return;
    const ord = orders.find((o) => String(o.id) === orderIdStr);
    if (!ord) return;

    if (type === 'Income' && category === 'Customer Payment') {
      const info = getOrderPaymentInfo(ord);
      if (info.remaining > 0) {
        setAmount(info.remaining.toFixed(2));
      }
      setInvoiceNumber(ord.orderNumber);
    } else if (type === 'Income' && category === 'Order Revenue') {
      setAmount(Number(ord.amount).toFixed(2));
      setInvoiceNumber(ord.orderNumber);
    } else if (type === 'Expense' && category === 'Shipping') {
      if (ord.carrier) setSelectedCarrier(ord.carrier);
      if (ord.trackingNumber) setInvoiceNumber(ord.trackingNumber);
    }
  };

  if (!isOpen) return null;

  // Switch between the 2 main tabs: Income (إيراد) | Expense (مصروف)
  const handleTabSwitch = (newType: TransactionType) => {
    setType(newType);
    setLinkedOrderId('');
    if (newType === 'Income') {
      setCategory('Customer Payment');
    } else {
      setCategory('Shipping');
    }
  };

  // Switch Dropdown 1 (نوع القيد)
  const handleCategoryChange = (newCat: TransactionCategory) => {
    setCategory(newCat);
    setLinkedOrderId('');
    if (
      newCat === 'Owner Capital Injection' ||
      newCat === 'Personal Withdrawal'
    ) {
      setCustomerId('');
    }
  };

  const isOwnerPersonalCategory =
    category === 'Owner Capital Injection' || category === 'Personal Withdrawal';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    let finalDescription = description.trim();
    const extraActions: UnifiedTransactionExtraActions = {};

    // Build automatic smart description & interconnected actions based on cascading dropdowns
    if (type === 'Income') {
      if (category === 'Customer Payment') {
        const cust = customers.find((c) => String(c.id) === customerId);
        const ord = orders.find((o) => String(o.id) === linkedOrderId);
        if (!finalDescription) {
          finalDescription = ord
            ? `Payment for Order ${ord.orderNumber}${cust ? ` — ${cust.firstName} ${cust.lastName}` : ''}`
            : `Customer Account Payment${cust ? ` — ${cust.firstName} ${cust.lastName}` : ''}`;
        }
        if (customerId && !editingTransaction) {
          extraActions.customerPaymentSettlement = {
            customerId: parseInt(customerId, 10),
            orderId: linkedOrderId ? parseInt(linkedOrderId, 10) : null,
            amount: numAmount,
            date,
            paymentMethod,
            description: finalDescription,
            referenceInvoice: invoiceNumber.trim() || ord?.orderNumber,
          };
        }
      } else if (category === 'Order Revenue') {
        const ord = orders.find((o) => String(o.id) === linkedOrderId);
        if (!finalDescription) {
          finalDescription = ord
            ? `Order Revenue ${ord.orderNumber}: ${ord.itemsDescription}`
            : 'Direct Order Sales Revenue';
        }
      } else if (category === 'Owner Capital Injection') {
        const cleanSource = injectionSource.split(' (')[0];
        if (!finalDescription) {
          finalDescription = cleanSource;
        } else if (!finalDescription.includes(cleanSource)) {
          finalDescription = `${cleanSource} — ${finalDescription}`;
        }
      } else if (category === 'Other Income') {
        if (!finalDescription) finalDescription = 'Other Operational Income';
      }
    } else {
      // EXPENSE
      if (category === 'Shipping') {
        const ord = orders.find((o) => String(o.id) === linkedOrderId);
        const lower = finalDescription.toLowerCase();
        const carrierLower = selectedCarrier.toLowerCase();
        if (!lower.includes(carrierLower)) {
          finalDescription = `${selectedCarrier} Local Parcel${
            ord ? ` (${ord.orderNumber})` : ''
          } — ${finalDescription || 'Standard ground dispatch'}`;
        }
        if (ord && ord.id && updateOrderToShipped && !editingTransaction) {
          extraActions.shipmentOrderUpdate = {
            orderId: ord.id,
            carrier: selectedCarrier,
            trackingNumber: invoiceNumber.trim() || ord.trackingNumber || '',
            shippedDate: date,
          };
        }
      } else if (category === 'Goods/Inventory') {
        const sup = suppliers.find((s) => String(s.id) === supplierId);
        const supName = sup ? sup.name : '';
        if (!finalDescription) {
          finalDescription = supName
            ? `${supName} — ${
                supplierActionMode === 'SUPPLIER_CREDIT_BILL'
                  ? 'Goods purchase invoice (On Credit)'
                  : 'Merchandise purchase & supplier settlement'
              }`
            : 'Direct Merchandise & Inventory Purchase';
        } else if (supName && !finalDescription.includes(supName)) {
          finalDescription = `${supName} — ${finalDescription}`;
        }

        if (sup && sup.id && supplierActionMode !== 'DIRECT_CASH' && !editingTransaction) {
          extraActions.supplierLedgerEntry = {
            supplierId: sup.id,
            type: supplierActionMode === 'SUPPLIER_CREDIT_BILL' ? 'Bill' : 'Payment',
            amount: numAmount,
            date,
            description: finalDescription,
            referenceInvoice: invoiceNumber.trim() || undefined,
            paymentMethod,
            recordInCashFinances: supplierActionMode !== 'SUPPLIER_CREDIT_BILL',
          };
        }
      } else if (category === 'Packaging & Supplies') {
        const cleanPkg = packagingType.split(' (')[0];
        const parts: string[] = [cleanPkg];
        if (batchQuantity.trim()) parts.push(`(${batchQuantity.trim()})`);
        if (finalDescription) parts.push(`— ${finalDescription}`);
        if (!editingTransaction) {
          finalDescription = parts.join(' ');
        }
      } else if (category === 'Personal Withdrawal') {
        const cleanReason = personalReason.split(' (')[0];
        if (!finalDescription) {
          finalDescription = cleanReason;
        } else if (!finalDescription.includes(cleanReason)) {
          finalDescription = `${cleanReason} — ${finalDescription}`;
        }
      } else {
        if (!finalDescription) {
          finalDescription = `${category} Expense`;
        }
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          id: editingTransaction?.id,
          type,
          category,
          description: finalDescription,
          amount: numAmount,
          date,
          customerId:
            isOwnerPersonalCategory || !customerId ? null : parseInt(customerId, 10),
          orderId: linkedOrderId ? parseInt(linkedOrderId, 10) : null,
          invoiceNumber: invoiceNumber.trim() || undefined,
          paymentMethod,
        },
        extraActions
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#141820] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0f131a]">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                type === 'Income'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {editingTransaction
                  ? tr('Edit Financial Entry', 'تعديل القيد المالي')
                  : tr('Record Financial Entry (Income / Expense)', 'تسجيل قيد جديد (إيراد / مصروف)')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {tr(
                  'Connected directly to Customers, Orders, Shipments, and Suppliers',
                  'مرتبط تلقائياً مع حسابات الزبائن، الطلبيات، الشحنات، والموردين'
                )}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* ================================================================= */}
          {/* STEP 1: TWO CLEAN TABS (إيراد | مصروف)                            */}
          {/* ================================================================= */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleTabSwitch('Income')}
              className={`py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'Income'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{tr('Income / Inflow (+€)', 'إيراد / وارد (+€)')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('Expense')}
              className={`py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                type === 'Expense'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{tr('Expense / Outflow (-€)', 'مصروف / صادر (-€)')}</span>
            </button>
          </div>

          {/* ================================================================= */}
          {/* STEP 2: PRIMARY DROPDOWN (نوع القيد)                              */}
          {/* ================================================================= */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              {type === 'Income'
                ? tr('1. Select Income Type', '1. اختر نوع الإيراد')
                : tr('1. Select Expense Type', '1. اختر نوع المصروف')}
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as TransactionCategory)}
              className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none transition-colors ${
                type === 'Income'
                  ? 'border-emerald-500/40 focus:border-emerald-400'
                  : 'border-rose-500/40 focus:border-rose-400'
              }`}
            >
              {type === 'Income' ? (
                <>
                  <option value="Customer Payment">
                    {tr(
                      'Customer Payment (Settle Unpaid Order / Balance)',
                      'تحصيل دفعة من زبون (تسديد طلبية أو رصيد ذمة)'
                    )}
                  </option>
                  <option value="Order Revenue">
                    {tr(
                      'Direct Order Sales Revenue',
                      'إيراد مبيعات طلبية مباشرة'
                    )}
                  </option>
                  <option value="Owner Capital Injection">
                    {tr(
                      'Add Personal Funds (+Owner Capital Injection)',
                      'إضافة نقود من المال الخاص (+دعم سيولة العمل)'
                    )}
                  </option>
                  <option value="Other Income">
                    {tr('Other Income', 'إيرادات أخرى عامة')}
                  </option>
                </>
              ) : (
                <>
                  <option value="Shipping">
                    {tr(
                      'Local Parcel Shipping (DHL, DPD, Hermes, GLS, UPS)',
                      'تكاليف شحن طرود محلي (DHL, DPD, Hermes, GLS, UPS)'
                    )}
                  </option>
                  <option value="Goods/Inventory">
                    {tr(
                      'Goods Purchase / Supplier Payment',
                      'مشتريات بضاعة ومخزون / دفعة لمورد'
                    )}
                  </option>
                  <option value="Packaging & Supplies">
                    {tr(
                      'Packaging Materials & Cartons Purchase',
                      'شراء مواد تغليف وكراتين ولوازم مستودع'
                    )}
                  </option>
                  <option value="Personal Withdrawal">
                    {tr(
                      'Withdraw Cash for Personal Use (-Personal Draw)',
                      'سحب نقود للاستخدام الشخصي (-مسحوبات خاصة)'
                    )}
                  </option>
                  <option value="Warehouse Rent">
                    {tr('Warehouse Rent & Utilities', 'إيجار المستودع والمرافق')}
                  </option>
                  <option value="Vehicle">
                    {tr('Vehicle, Van & Fuel Expenses', 'مصاريف المركبات والوقود والنقل')}
                  </option>
                  <option value="General">
                    {tr('General Operating Expense', 'مصاريف تشغيلية وإدارية عامة')}
                  </option>
                </>
              )}
            </select>
          </div>

          {/* ================================================================= */}
          {/* STEP 3: CASCADING DROPDOWNS BASED ON SELECTED CATEGORY            */}
          {/* ================================================================= */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Link2 className="w-3.5 h-3.5 text-sky-400" />
                {tr(
                  '2. Connected Details (Adapts to Entry Type)',
                  '2. القائمة التابعة وتفاصيل الربط التلقائي'
                )}
              </span>
              <span className="font-mono text-[10px] text-sky-400">
                {tr('AUTO-LINKED', 'ترابط ذكي')}
              </span>
            </div>

            {/* CASE A: INCOME -> CUSTOMER PAYMENT OR ORDER REVENUE */}
            {type === 'Income' &&
              (category === 'Customer Payment' || category === 'Order Revenue') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {tr('Select Customer', 'اختر الزبون')}
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value);
                        setLinkedOrderId('');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">
                        {tr('-- Select Customer --', '-- اختر الزبون --')}
                      </option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {category === 'Customer Payment'
                        ? tr('Order / Balance to Settle', 'الطلبية المراد تسديدها')
                        : tr('Linked Order (Optional)', 'الطلبية المرتبطة (اختياري)')}
                    </label>
                    <select
                      value={linkedOrderId}
                      onChange={(e) => handleSelectLinkedOrder(e.target.value)}
                      disabled={!customerId}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">
                        {category === 'Customer Payment'
                          ? selectedCustomerDebt > 0
                            ? tr(
                                `General Balance Settlement (Due: €${selectedCustomerDebt.toFixed(2)})`,
                                `تسديد من الرصيد العام للزبون (الذمة: €${selectedCustomerDebt.toFixed(2)})`
                              )
                            : tr(
                                '-- General Customer Account --',
                                '-- رصيد حساب الزبون العام --'
                              )
                          : tr('-- General / No Specific Order --', '-- بدون طلبية محددة --')}
                      </option>
                      {(category === 'Customer Payment'
                        ? unpaidCustomerOrders
                        : customerOrders
                      ).map((ord) => {
                        const info = getOrderPaymentInfo(ord);
                        return (
                          <option key={ord.id} value={ord.id}>
                            {ord.orderNumber} — {ord.itemsDescription} (
                            {category === 'Customer Payment'
                              ? `${tr('Due', 'متبقي')}: €${info.remaining.toFixed(2)}`
                              : `€${Number(ord.amount).toFixed(2)}`}
                            )
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {category === 'Customer Payment' && customerId && (
                    <div className="sm:col-span-2 flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs">
                      <span className="text-emerald-300 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        {tr(
                          'Current Unpaid Customer Balance:',
                          'إجمالي الذمة غير المدفوعة على هذا الزبون:'
                        )}
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        €{selectedCustomerDebt.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* CASE B: INCOME -> OWNER CAPITAL INJECTION */}
            {type === 'Income' && category === 'Owner Capital Injection' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-teal-300 mb-1">
                    {tr('Personal Funds Source / Purpose', 'مصدر أو سبب إضافة المال الخاص')}
                  </label>
                  <select
                    value={injectionSource}
                    onChange={(e) => setInjectionSource(e.target.value)}
                    className="w-full bg-slate-950 border border-teal-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {OWNER_INJECTION_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* CASE C: INCOME -> OTHER INCOME */}
            {type === 'Income' && category === 'Other Income' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tr('Linked Customer (Optional)', 'ربط بزبون (اختياري)')}
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="">
                    {tr('-- General Income (No Customer) --', '-- إيراد عام (بدون زبون) --')}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CASE D: EXPENSE -> SHIPPING */}
            {type === 'Expense' && category === 'Shipping' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-sky-300 mb-1">
                      {tr('Shipping Carrier', 'شركة الشحن المحلي')}
                    </label>
                    <select
                      value={selectedCarrier}
                      onChange={(e) => setSelectedCarrier(e.target.value as CarrierType)}
                      className="w-full bg-slate-950 border border-sky-500/40 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none"
                    >
                      {LOCAL_CARRIERS.map((car) => (
                        <option key={car} value={car}>
                          {car}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {tr('Customer (Optional)', 'الزبون (اختياري)')}
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value);
                        setLinkedOrderId('');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="">
                        {tr('-- General Dispatch --', '-- شحن عام --')}
                      </option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {tr('Customer Order', 'ربط بطلبية الزبون')}
                    </label>
                    <select
                      value={linkedOrderId}
                      onChange={(e) => handleSelectLinkedOrder(e.target.value)}
                      disabled={!customerId}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                    >
                      <option value="">
                        {tr('-- No Specific Order --', '-- بدون طلبية محددة --')}
                      </option>
                      {customerOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.orderNumber} ({ord.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {linkedOrderId && !editingTransaction && (
                  <label className="flex items-center gap-2 text-xs text-sky-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={updateOrderToShipped}
                      onChange={(e) => setUpdateOrderToShipped(e.target.checked)}
                      className="rounded border-slate-600 text-sky-500 focus:ring-sky-500"
                    />
                    <span>
                      {tr(
                        'Automatically mark linked order as "Shipped" & attach tracking number',
                        'تحويل حالة الطلبية تلقائياً إلى "تم الشحن" وربط رقم التتبع بها'
                      )}
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* CASE E: EXPENSE -> GOODS / INVENTORY & SUPPLIERS */}
            {type === 'Expense' && category === 'Goods/Inventory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-rose-300 mb-1">
                    {tr('Select Goods Supplier', 'اختر مورد البضاعة')}
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-rose-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">
                      {tr(
                        '-- Direct Market Purchase (No Supplier Account) --',
                        '-- شراء مباشر من السوق (بدون حساب مورد) --'
                      )}
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {tr('Supplier Operation Type', 'طريقة معالجة المشتريات مع المورد')}
                  </label>
                  <select
                    value={supplierId ? supplierActionMode : 'DIRECT_CASH'}
                    onChange={(e) => setSupplierActionMode(e.target.value as any)}
                    disabled={!supplierId}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="SUPPLIER_PAYMENT">
                      {tr(
                        'Pay Supplier Now (Deducts Cash & Supplier Debt)',
                        'دفعة مسددة للمورد (تُخصم من الصندوق ومن دين المورد)'
                      )}
                    </option>
                    <option value="SUPPLIER_CREDIT_BILL">
                      {tr(
                        'Purchase Bill on Credit (Adds to Supplier Debt Only)',
                        'فاتورة شراء بالآجل على الحساب (تزيد ذمة المورد)'
                      )}
                    </option>
                    <option value="DIRECT_CASH">
                      {tr(
                        'Direct Cash Purchase Only (No Supplier Balance Impact)',
                        'شراء نقدي مباشر (يُسجل في المصاريف فقط)'
                      )}
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* CASE F: EXPENSE -> PACKAGING & SUPPLIES */}
            {type === 'Expense' && category === 'Packaging & Supplies' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-purple-300 mb-1">
                    {tr('Packaging Material Type', 'صنف مواد التغليف')}
                  </label>
                  <select
                    value={packagingType}
                    onChange={(e) => setPackagingType(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {PACKAGING_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {tr('Quantity / Batch Size', 'الكمية / عدد الوحدات')}
                  </label>
                  <input
                    type="text"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value)}
                    placeholder={tr('e.g. 500 Cartons, 30 Rolls', 'مثال: 500 كرتونة، 30 رول')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* CASE G: EXPENSE -> PERSONAL WITHDRAWAL */}
            {type === 'Expense' && category === 'Personal Withdrawal' && (
              <div>
                <label className="block text-xs font-medium text-orange-300 mb-1">
                  {tr('Personal Withdrawal Purpose', 'غرض السحب الشخصي')}
                </label>
                <select
                  value={personalReason}
                  onChange={(e) => setPersonalReason(e.target.value)}
                  className="w-full bg-slate-950 border border-orange-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {PERSONAL_WITHDRAWAL_REASONS.map((rsn) => (
                    <option key={rsn} value={rsn}>
                      {rsn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CASE H: EXPENSE -> FACILITY / VEHICLE / GENERAL */}
            {type === 'Expense' &&
              (category === 'Warehouse Rent' ||
                category === 'Vehicle' ||
                category === 'General') && (
                <div className="text-xs text-slate-400">
                  {tr(
                    'Operating expense will be recorded directly in the unified financial ledger.',
                    'سيتم تسجيل هذا المصروف التشغيلي مباشرة في السجل المالي الموحد.'
                  )}
                </div>
              )}
          </div>

          {/* ================================================================= */}
          {/* STEP 4: AMOUNT, DATE, PAYMENT METHOD & DESCRIPTION                */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                {tr('Amount (€)', 'المبلغ (€)')} <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
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
                  className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {tr('Payment Method', 'طريقة الدفع')}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="Cash">{tr('Cash (Safe)', 'نقدي (الصندوق)')}</option>
                <option value="Bank Transfer">
                  {tr('Bank Transfer (SEPA)', 'تحويل بنكي (SEPA)')}
                </option>
                <option value="Credit Card">{tr('Card', 'بطاقة بنكية')}</option>
                <option value="PayPal">PayPal</option>
                <option value="Other">{tr('Other', 'أخرى')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {tr('Date', 'التاريخ')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {tr('Description / Note (Optional - Auto-generated if empty)', 'البيان / ملاحظة (اختياري - يُكتب تلقائياً إن تُرك فارغاً)')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={tr(
                  'Additional details or leave blank for automatic description...',
                  'أضف تفاصيل إضافية أو اتركه فارغاً ليتم توليده تلقائياً...'
                )}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {category === 'Shipping'
                  ? tr('Tracking / Waybill #', 'رقم التتبع / البوليصة')
                  : tr('Invoice / Ref #', 'رقم الفاتورة / المرجع')}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={
                  category === 'Shipping' ? '00340434...' : 'INV-2026...'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {tr('Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-40 ${
                type === 'Income'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? tr('Saving...', 'جاري الحفظ...')
                  : editingTransaction
                  ? tr('Save Changes', 'حفظ التعديلات')
                  : type === 'Income'
                  ? tr('Record Income (+€)', 'حفظ قيد الإيراد (+€)')
                  : tr('Record Expense (-€)', 'حفظ قيد المصروف (-€)')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
