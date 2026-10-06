import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Wallet, CheckCircle2 } from 'lucide-react';
import type { Customer, CustomerOrder } from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

interface CustomerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  orders: CustomerOrder[];
  prefilledCustomerId?: number | null;
  prefilledOrderId?: number | null;
  onReceivePayment: (payload: {
    customerId: number;
    orderId: number | null;
    amount: number;
    date: string;
    paymentMethod: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
    description: string;
    referenceInvoice?: string;
  }) => Promise<void>;
}

export const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({
  isOpen,
  onClose,
  customers,
  orders,
  prefilledCustomerId,
  prefilledOrderId,
  onReceivePayment,
}) => {
  const { tr } = useI18n();
  const [customerId, setCustomerId] = useState<number>(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('ALL_BALANCE');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<
    'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other'
  >('Bank Transfer');
  const [description, setDescription] = useState<string>('');
  const [referenceInvoice, setReferenceInvoice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute customer orders & unpaid balance for the selected customer
  const customerOrderSummary = useMemo(() => {
    const custOrders = orders
      .filter((o) => o.customerId === Number(customerId) && o.status !== 'Cancelled')
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    const unpaidOrders: Array<
      CustomerOrder & { remaining: number; paid: number }
    > = [];

    custOrders.forEach((o) => {
      const info = getOrderPaymentInfo(o);
      totalBilled += info.total;
      totalPaid += info.paid;
      totalRemaining += info.remaining;
      if (info.remaining > 0.01) {
        unpaidOrders.push({
          ...o,
          remaining: info.remaining,
          paid: info.paid,
        });
      }
    });

    return {
      totalBilled,
      totalPaid,
      totalRemaining,
      unpaidOrders,
      allOrdersCount: custOrders.length,
    };
  }, [orders, customerId]);

  useEffect(() => {
    if (!isOpen) return;

    let initCustId = prefilledCustomerId || customers[0]?.id || 0;
    if (prefilledOrderId) {
      const targetOrd = orders.find((o) => o.id === prefilledOrderId);
      if (targetOrd) {
        initCustId = targetOrd.customerId;
      }
    }
    setCustomerId(initCustId);
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('Bank Transfer');

    if (prefilledOrderId) {
      setSelectedOrderId(String(prefilledOrderId));
      const targetOrd = orders.find((o) => o.id === prefilledOrderId);
      if (targetOrd) {
        const info = getOrderPaymentInfo(targetOrd);
        setAmount(info.remaining > 0 ? info.remaining.toFixed(2) : '');
        setDescription(`Payment received for Order ${targetOrd.orderNumber}`);
        setReferenceInvoice(targetOrd.orderNumber);
      }
    } else {
      setSelectedOrderId('ALL_BALANCE');
      // Calculate remaining balance for initCustId
      let rem = 0;
      orders
        .filter((o) => o.customerId === Number(initCustId) && o.status !== 'Cancelled')
        .forEach((o) => {
          rem += getOrderPaymentInfo(o).remaining;
        });
      setAmount(rem > 0 ? rem.toFixed(2) : '');
      setDescription('Customer account balance settlement');
      setReferenceInvoice('');
    }
  }, [isOpen, prefilledCustomerId, prefilledOrderId, customers, orders]);

  if (!isOpen) return null;

  const handleCustomerChange = (newCustId: number) => {
    setCustomerId(newCustId);
    setSelectedOrderId('ALL_BALANCE');
    let rem = 0;
    orders
      .filter((o) => o.customerId === newCustId && o.status !== 'Cancelled')
      .forEach((o) => {
        rem += getOrderPaymentInfo(o).remaining;
      });
    setAmount(rem > 0 ? rem.toFixed(2) : '');
    setDescription('Customer account balance settlement');
    setReferenceInvoice('');
  };

  const handleOrderSelectChange = (val: string) => {
    setSelectedOrderId(val);
    if (val === 'ALL_BALANCE') {
      setAmount(
        customerOrderSummary.totalRemaining > 0
          ? customerOrderSummary.totalRemaining.toFixed(2)
          : ''
      );
      setDescription('Customer account balance settlement');
      setReferenceInvoice('');
    } else {
      const ord = customerOrderSummary.unpaidOrders.find((o) => String(o.id) === val);
      if (ord) {
        setAmount(ord.remaining.toFixed(2));
        setDescription(`Payment received for Order ${ord.orderNumber}`);
        setReferenceInvoice(ord.orderNumber);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!customerId || isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onReceivePayment({
        customerId: Number(customerId),
        orderId: selectedOrderId === 'ALL_BALANCE' ? null : Number(selectedOrderId),
        amount: numAmount,
        date,
        paymentMethod,
        description:
          description.trim() || 'Customer payment received (Balance settlement)',
        referenceInvoice: referenceInvoice.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const numEntering = parseFloat(amount) || 0;
  const newRemainingAfterPayment = Math.max(
    0,
    customerOrderSummary.totalRemaining - numEntering
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {tr('Receive Customer Payment', 'تلقي دفعة من الزبون')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {tr(
                  'Settle unpaid orders or balance customer account receivables',
                  'تسديد الطلبيات الآجلة أو موازنة رصيد ذمم الزبون'
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Customer Account', 'حساب الزبون')} <span className="text-rose-400">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => handleCustomerChange(Number(e.target.value))}
              required
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} {c.company ? `(${c.company})` : ''} — {c.city}
                </option>
              ))}
            </select>
          </div>

          {/* Live Customer Account Balance Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">
                {tr('Customer Orders & Receivables Summary:', 'ملخص طلبيات وذمم الزبون:')}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {customerOrderSummary.allOrdersCount} {tr('Total Orders', 'إجمالي الطلبات')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block">
                  {tr('Total Orders Billed', 'إجمالي الطلبيات')}
                </span>
                <span className="text-white font-bold">
                  €{customerOrderSummary.totalBilled.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block">
                  {tr('Paid Previously', 'المدفوع سابقاً')}
                </span>
                <span className="text-emerald-400 font-bold">
                  €{customerOrderSummary.totalPaid.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-sans text-slate-500 block">
                  {tr('Unpaid Balance Due', 'الرصيد المتبقي')}
                </span>
                <span
                  className={`font-bold ${
                    customerOrderSummary.totalRemaining > 0.01
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  €{customerOrderSummary.totalRemaining.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Target Order or General Balance Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Apply Payment To', 'تخصيص الدفعة إلى')}
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleOrderSelectChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL_BALANCE">
                {tr(
                  'General Account Balance Settlement (Auto-settles oldest unpaid orders)',
                  'موازنة الرصيد العام — يسدد الطلبيات الأقدم تلقائياً'
                )}
              </option>
              {customerOrderSummary.unpaidOrders.map((ord) => (
                <option key={ord.id} value={String(ord.id)}>
                  {tr('Order', 'طلبية')} {ord.orderNumber} ({ord.orderDate}) —{' '}
                  {tr('Remaining Due:', 'المتبقي:')} €{ord.remaining.toFixed(2)} (
                  {tr('of', 'من')} €{ord.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  {tr('Payment Received (€)', 'المبلغ المستلم (€)')}{' '}
                  <span className="text-rose-400">*</span>
                </label>
                {customerOrderSummary.totalRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAmount(customerOrderSummary.totalRemaining.toFixed(2))
                    }
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    {tr('Full Balance', 'كامل الرصيد')} (€
                    {customerOrderSummary.totalRemaining.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-slate-500 font-mono text-sm">
                  €
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg pl-8 pr-3.5 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Payment Date', 'تاريخ الدفعة')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Payment Method', 'طريقة الدفع')}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Bank Transfer">
                  {tr('Bank Transfer (SEPA)', 'تحويل بنكي (SEPA)')}
                </option>
                <option value="Cash">{tr('Cash Payment', 'دفع نقدي (Cash)')}</option>
                <option value="PayPal">PayPal</option>
                <option value="Credit Card">
                  {tr('Card / Terminal', 'بطاقة ائتمان')}
                </option>
                <option value="Other">{tr('Other', 'طريقة أخرى')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Reference / Order #', 'رقم المرجع / الطلبية')}{' '}
                <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
              </label>
              <input
                type="text"
                value={referenceInvoice}
                onChange={(e) => setReferenceInvoice(e.target.value)}
                placeholder="e.g. ORD-2026-8401 or REC-109"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Payment Note / Description', 'ملاحظة / بيان الدفعة')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr(
                'e.g. Settlement payment received from customer',
                'مثال: دفعة تسديد رصيد مستلمة من الزبون'
              )}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Post-Payment Balance Preview */}
          {numEntering > 0 && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between text-xs">
              <span className="text-emerald-300 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {tr(
                  'Remaining Customer Debt After This Payment:',
                  'الرصيد المتبقي بذمة الزبون بعد هذه الدفعة:'
                )}
              </span>
              <span className="font-mono font-bold text-white text-sm">
                €{newRemainingAfterPayment.toFixed(2)}
              </span>
            </div>
          )}

          {/* Actions */}
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
              disabled={isSubmitting || !customerId || !amount || numEntering <= 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? tr('Recording...', 'جاري التسجيل...')
                  : `${tr('Confirm Payment', 'تأكيد استلام الدفعة')} (+€${numEntering.toFixed(2)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
