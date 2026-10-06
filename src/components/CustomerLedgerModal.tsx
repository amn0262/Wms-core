import React, { useState, useMemo } from 'react';
import {
  X,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  Building2,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Wallet,
  Truck,
  BookOpen,
} from 'lucide-react';
import type { Customer, CustomerOrder, Transaction, OrderStatus } from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  orders: CustomerOrder[];
  transactions: Transaction[];
  onOpenNewOrder: (customerId: number) => void;
  onOpenReceivePayment: (customerId: number, orderId?: number) => void;
  onOpenNewExpense: (customerId: number) => void;
  onEditOrder: (order: CustomerOrder) => void;
  onUpdateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (orderId: number) => Promise<void>;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: number) => Promise<void>;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  isOpen,
  onClose,
  customer,
  orders,
  transactions,
  onOpenNewOrder,
  onOpenReceivePayment,
  onOpenNewExpense,
  onEditOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const { tr, translateOrderStatus, translateCategory, translatePaymentMethod } = useI18n();
  const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'statement'>('orders');

  const {
    customerOrders,
    customerPayments,
    customerShippingExpenses,
    totalOrdersBilled,
    totalPaymentsReceived,
    remainingBalanceDue,
    totalShippingSpent,
    statementRows,
  } = useMemo(() => {
    if (!customer || !customer.id) {
      return {
        customerOrders: [],
        customerPayments: [],
        customerShippingExpenses: [],
        totalOrdersBilled: 0,
        totalPaymentsReceived: 0,
        remainingBalanceDue: 0,
        totalShippingSpent: 0,
        statementRows: [],
      };
    }

    const cOrders = orders
      .filter((o) => o.customerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime() ||
          b.timestamp - a.timestamp
      );

    const cTxs = transactions
      .filter((t) => t.customerId === customer.id)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.timestamp - a.timestamp
      );

    const payments = cTxs.filter((t) => t.type === 'Income');
    const shippingExps = cTxs.filter((t) => t.type === 'Expense');

    let ordBilled = 0;
    let ordRemaining = 0;
    cOrders.forEach((o) => {
      if (o.status !== 'Cancelled') {
        const info = getOrderPaymentInfo(o);
        ordBilled += info.total;
        ordRemaining += info.remaining;
      }
    });

    const paymentsSum = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const shippingSum = shippingExps.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

    // If customer had standalone legacy income entries without a CustomerOrder record, include them in billed
    const effectiveBilled = Math.max(ordBilled, paymentsSum + ordRemaining);

    // Build chronological statement rows (oldest to newest for running balance)
    const rawEvents: Array<{
      id: string;
      date: string;
      timestamp: number;
      kind: 'ORDER' | 'PAYMENT' | 'SHIPPING';
      title: string;
      reference: string;
      debitOrder: number; // + increases what customer owes
      creditPayment: number; // - decreases what customer owes
      shippingCost: number;
    }> = [];

    cOrders.forEach((o) => {
      if (o.status === 'Cancelled') return;
      rawEvents.push({
        id: `ord-${o.id}`,
        date: o.orderDate,
        timestamp: o.timestamp,
        kind: 'ORDER',
        title: `Order ${o.orderNumber}: ${o.itemsDescription} (${o.status})`,
        reference: o.trackingNumber ? `${o.carrier || 'DHL'}: ${o.trackingNumber}` : o.orderNumber,
        debitOrder: Number(o.amount) || 0,
        creditPayment: 0,
        shippingCost: 0,
      });
    });

    payments.forEach((p) => {
      rawEvents.push({
        id: `pay-${p.id}`,
        date: p.date,
        timestamp: p.timestamp,
        kind: 'PAYMENT',
        title: p.description,
        reference: p.invoiceNumber || p.paymentMethod || 'Payment',
        debitOrder: 0,
        creditPayment: Number(p.amount) || 0,
        shippingCost: 0,
      });
    });

    shippingExps.forEach((s) => {
      rawEvents.push({
        id: `shp-${s.id}`,
        date: s.date,
        timestamp: s.timestamp,
        kind: 'SHIPPING',
        title: s.description,
        reference: s.invoiceNumber || 'Local Shipping',
        debitOrder: 0,
        creditPayment: 0,
        shippingCost: Number(s.amount) || 0,
      });
    });

    rawEvents.sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime() ||
        a.timestamp - b.timestamp
    );

    let runningBal = 0;
    const computedStatement = rawEvents.map((ev) => {
      runningBal += ev.debitOrder - ev.creditPayment;
      return {
        ...ev,
        runningBalance: Math.max(0, runningBal),
      };
    });

    return {
      customerOrders: cOrders,
      customerPayments: payments,
      customerShippingExpenses: shippingExps,
      totalOrdersBilled: effectiveBilled,
      totalPaymentsReceived: paymentsSum,
      remainingBalanceDue: ordRemaining,
      totalShippingSpent: shippingSum,
      statementRows: [...computedStatement].reverse(),
    };
  }, [customer, orders, transactions]);

  if (!isOpen || !customer) return null;

  const hasUnpaidBalance = remainingBalanceDue > 0.01;

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Entry Type',
      'Description',
      'Reference / Tracking',
      'Order Billed (+)',
      'Payment Received (-)',
      'Local Shipping Cost',
      'Running Customer Balance',
    ];

    const rows = [...statementRows].reverse().map((r) => [
      r.date,
      r.kind,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.reference.replace(/"/g, '""')}"`,
      r.debitOrder.toFixed(2),
      r.creditPayment.toFixed(2),
      r.shippingCost.toFixed(2),
      r.runningBalance.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Customer_Orders_And_Payments_${customer.firstName}_${customer.lastName}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-500/15 text-sky-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {customer.firstName} {customer.lastName}
                </h2>
                {customer.company && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {customer.company}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" />
                  {customer.address}, {customer.postalCode} {customer.city}
                </span>
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {tr('Export Statement CSV', 'تصدير كشف الحساب CSV')}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary KPI Cards + Action Bar */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Orders Billed */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">
                {tr('Total Orders Value', 'إجمالي قيمة الطلبيات')}
              </span>
              <div className="text-lg font-bold font-mono text-white mt-1">
                €{totalOrdersBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {customerOrders.length} {tr('orders recorded', 'طلبيات مسجلة')}
              </span>
            </div>

            {/* Total Payments Received */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">
                {tr('Payments Received', 'إجمالي الدفعات المستلمة')}
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                +€{totalPaymentsReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {customerPayments.length} {tr('payment receipts', 'سندات قبض')}
              </span>
            </div>

            {/* Unpaid Customer Balance Due */}
            <div
              className={`p-3.5 rounded-xl border ${
                hasUnpaidBalance
                  ? 'bg-rose-950/30 border-rose-800/50'
                  : 'bg-emerald-950/20 border-emerald-800/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200">
                  {tr('Unpaid Balance', 'الرصيد المتبقي')}
                </span>
                {hasUnpaidBalance ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400">
                    <AlertCircle className="w-3 h-3" /> {tr('Due', 'مستحق')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> {tr('Settled', 'خالص')}
                  </span>
                )}
              </div>
              <div
                className={`text-lg font-bold font-mono mt-1 ${
                  hasUnpaidBalance ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                €{remainingBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {hasUnpaidBalance
                  ? tr('Receivable owed by customer for orders', 'مبلغ مستحق بذمة الزبون')
                  : tr('All customer orders are fully paid', 'جميع طلبيات الزبون مسددة بالكامل')}
              </span>
            </div>

            {/* Local Parcel Shipping Costs */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium block">
                {tr('Local Shipping Costs', 'تكاليف الشحن المحلي')}
              </span>
              <div className="text-lg font-bold font-mono text-sky-400 mt-1">
                €{totalShippingSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {tr('Net Cash Profit:', 'صافي الربح النقدي:')} €
                {(totalPaymentsReceived - totalShippingSpent).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Navigation Tabs & Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>
                  {tr('Customer Orders', 'طلبيات الزبون')} ({customerOrders.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'payments'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {tr('Payments Received', 'الدفعات المستلمة')} ({customerPayments.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'statement'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  {tr('Full Account Statement', 'كشف الحساب الكامل')} ({statementRows.length})
                </span>
              </button>
            </div>

            {/* Quick Actions for this Customer */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => customer.id && onOpenReceivePayment(customer.id)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {hasUnpaidBalance
                    ? `${tr('+ Receive Payment', '+ تلقي دفعة')} (€${remainingBalanceDue.toFixed(2)})`
                    : tr('+ Receive Customer Payment', '+ تلقي دفعة من الزبون')}
                </span>
              </button>

              <button
                onClick={() => customer.id && onOpenNewOrder(customer.id)}
                className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-xs font-semibold text-sky-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>
                  {tr('+ New Order (Paid or Unpaid)', '+ طلبية جديدة (مدفوعة أو آجلة)')}
                </span>
              </button>

              <button
                onClick={() => customer.id && onOpenNewExpense(customer.id)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                <span>{tr('+ Local Shipping Cost', '+ تكلفة شحن محلي')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: CUSTOMER ORDERS & PAYMENT STATUS */}
          {activeTab === 'orders' && (
            <>
              {customerOrders.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                  {tr(
                    'No orders recorded for this customer yet. Click "+ New Order" above to create a paid or unpaid order.',
                    'لا توجد طلبيات مسجلة لهذا الزبون بعد. اضغط على "+ طلبية جديدة" أعلاه لإنشاء طلبية مدفوعة أو آجلة.'
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                        <th className="py-3 px-3.5 text-start">
                          {tr('Order # & Date', 'رقم الطلبية والتاريخ')}
                        </th>
                        <th className="py-3 px-3.5 text-start">
                          {tr('Items & Tracking', 'الأصناف والتتبع')}
                        </th>
                        <th className="py-3 px-3.5 text-center">
                          {tr('Order Status', 'وضع الطلبية')}
                        </th>
                        <th className="py-3 px-3.5 text-end">
                          {tr('Order Value', 'قيمة الطلبية')}
                        </th>
                        <th className="py-3 px-3.5 text-end">{tr('Paid', 'المدفوع')}</th>
                        <th className="py-3 px-3.5 text-end">{tr('Remaining', 'المتبقي')}</th>
                        <th className="py-3 px-3.5 text-center">
                          {tr('Payment Status', 'حالة الدفع')}
                        </th>
                        <th className="py-3 px-3.5 text-end">{tr('Actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {customerOrders.map((ord) => {
                        const payInfo = getOrderPaymentInfo(ord);
                        return (
                          <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-mono font-bold text-white">
                                {ord.orderNumber}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {ord.orderDate}
                              </div>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-medium text-slate-200">
                                {ord.itemsDescription}
                              </div>
                              {ord.trackingNumber && (
                                <div className="text-[10px] font-mono text-sky-400 mt-0.5">
                                  {ord.carrier || 'DHL'}: {ord.trackingNumber}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <select
                                value={ord.status}
                                onChange={(e) =>
                                  ord.id &&
                                  onUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                                }
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] font-semibold text-white focus:outline-none cursor-pointer"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {translateOrderStatus(st)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3.5 text-end font-mono font-bold text-white whitespace-nowrap">
                              €{payInfo.total.toFixed(2)}
                            </td>
                            <td className="py-3 px-3.5 text-end font-mono font-medium text-emerald-400 whitespace-nowrap">
                              €{payInfo.paid.toFixed(2)}
                            </td>
                            <td className="py-3 px-3.5 text-end font-mono font-bold text-rose-400 whitespace-nowrap">
                              {payInfo.remaining > 0.01 ? `€${payInfo.remaining.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              {payInfo.paymentStatus === 'Paid' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" /> {tr('Paid', 'مدفوعة')}
                                </span>
                              ) : payInfo.paymentStatus === 'Partially Paid' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3" /> {tr('Partial', 'جزئي')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <AlertCircle className="w-3 h-3" /> {tr('Unpaid', 'غير مدفوعة')}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-end whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {payInfo.remaining > 0.01 && customer.id && (
                                  <button
                                    onClick={() => onOpenReceivePayment(customer.id!, ord.id)}
                                    className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
                                    title={tr(
                                      'Receive payment for this order',
                                      'تلقي دفعة لهذه الطلبية'
                                    )}
                                  >
                                    {tr('Pay', 'سداد')} €{payInfo.remaining.toFixed(2)}
                                  </button>
                                )}
                                <button
                                  onClick={() => onEditOrder(ord)}
                                  title={tr('Edit order', 'تعديل الطلبية')}
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (
                                      ord.id &&
                                      window.confirm(
                                        tr(
                                          `Delete order ${ord.orderNumber}?`,
                                          `هل أنت متأكد من حذف الطلبية ${ord.orderNumber}؟`
                                        )
                                      )
                                    ) {
                                      onDeleteOrder(ord.id);
                                    }
                                  }}
                                  title={tr('Delete order', 'حذف الطلبية')}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
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
            </>
          )}

          {/* TAB 2: CUSTOMER PAYMENTS RECEIVED */}
          {activeTab === 'payments' && (
            <>
              {customerPayments.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                  {tr(
                    'No payments received from this customer yet. Click "+ Receive Payment" above when the customer pays.',
                    'لا توجد دفعات مستلمة من هذا الزبون بعد. اضغط على "+ تلقي دفعة" أعلاه عند استلام دفعة.'
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                        <th className="py-3 px-4 text-start">{tr('Date', 'التاريخ')}</th>
                        <th className="py-3 px-4 text-start">{tr('Payment Type', 'نوع الدفعة')}</th>
                        <th className="py-3 px-4 text-start">
                          {tr('Description & Note', 'البيان والملاحظات')}
                        </th>
                        <th className="py-3 px-4 text-start">
                          {tr('Reference / Method', 'المرجع / الطريقة')}
                        </th>
                        <th className="py-3 px-4 text-end">
                          {tr('Amount Received', 'المبلغ المستلم')}
                        </th>
                        <th className="py-3 px-4 text-end">{tr('Actions', 'إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {customerPayments.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {pay.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <Wallet className="w-3 h-3" /> {translateCategory(pay.category)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-medium">
                            {pay.description}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {pay.invoiceNumber || '—'}
                            {pay.paymentMethod && (
                              <span className="block text-[10px] font-sans text-slate-500">
                                {translatePaymentMethod(pay.paymentMethod)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-end font-mono font-bold text-emerald-400 whitespace-nowrap">
                            +€{Number(pay.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-end whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onEditTransaction(pay)}
                                title={tr('Edit payment', 'تعديل الدفعة')}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    pay.id &&
                                    window.confirm(
                                      tr(
                                        `Delete payment of €${pay.amount.toFixed(2)}?`,
                                        `هل أنت متأكد من حذف الدفعة بقيمة €${pay.amount.toFixed(2)}؟`
                                      )
                                    )
                                  ) {
                                    onDeleteTransaction(pay.id);
                                  }
                                }}
                                title={tr('Delete payment', 'حذف الدفعة')}
                                className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* TAB 3: FULL ACCOUNT STATEMENT (ORDERS, PAYMENTS & SHIPPING) */}
          {activeTab === 'statement' && (
            <>
              {statementRows.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                  {tr(
                    'No account activity recorded for this customer yet.',
                    'لا توجد حركات مسجلة في حساب هذا الزبون بعد.'
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                        <th className="py-3 px-4 text-start">{tr('Date', 'التاريخ')}</th>
                        <th className="py-3 px-4 text-start">{tr('Operation', 'العملية')}</th>
                        <th className="py-3 px-4 text-start">
                          {tr('Details & Reference', 'التفاصيل والمرجع')}
                        </th>
                        <th className="py-3 px-4 text-end">
                          {tr('Order Billed (+)', 'قيمة الطلبية (+)')}
                        </th>
                        <th className="py-3 px-4 text-end">
                          {tr('Payment Received (-)', 'دفعة مستلمة (-)')}
                        </th>
                        <th className="py-3 px-4 text-end">
                          {tr('Local Shipping', 'شحن محلي')}
                        </th>
                        <th className="py-3 px-4 text-end">
                          {tr('Running Debt Balance', 'الرصيد التراكمي المتبقي')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {statementRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                row.kind === 'ORDER'
                                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                  : row.kind === 'PAYMENT'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {row.kind === 'ORDER'
                                ? tr('ORDER', 'طلبية')
                                : row.kind === 'PAYMENT'
                                ? tr('PAYMENT', 'دفعة')
                                : tr('SHIPPING', 'شحن')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200 font-medium">{row.title}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {tr('Ref:', 'مرجع:')} {row.reference}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-white whitespace-nowrap">
                            {row.debitOrder > 0 ? `€${row.debitOrder.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-emerald-400 font-semibold whitespace-nowrap">
                            {row.creditPayment > 0 ? `-€${row.creditPayment.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-sky-400 whitespace-nowrap">
                            {row.shippingCost > 0 ? `€${row.shippingCost.toFixed(2)}` : '—'}
                          </td>
                          <td
                            className={`py-3 px-4 text-end font-mono font-bold whitespace-nowrap ${
                              row.runningBalance > 0.01 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            €{row.runningBalance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {tr('Close Customer Statement', 'إغلاق كشف حساب الزبون')}
          </button>
        </div>
      </div>
    </div>
  );
};
