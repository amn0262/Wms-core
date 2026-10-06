import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Printer,
  PlusCircle,
  Edit2,
  Trash2,
  MapPin,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  Package,
  Truck,
  Wallet,
  BookOpen,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { Customer, Transaction, CustomerOrder, OrderStatus } from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';
import { CustomerLedgerModal } from './CustomerLedgerModal';
import { useI18n } from '../utils/i18n';

interface CustomersViewProps {
  customers: Customer[];
  transactions: Transaction[];
  orders?: CustomerOrder[];
  onOpenCustomerModal: (customerToEdit?: Customer) => void;
  onOpenTransactionWithCustomer: (customerId: number) => void;
  onOpenOrderWithCustomer?: (customerId: number) => void;
  onOpenReceivePaymentModal?: (customerId: number, orderId?: number) => void;
  onEditOrder?: (order: CustomerOrder) => void;
  onUpdateOrderStatus?: (orderId: number, status: OrderStatus) => Promise<void>;
  onDeleteOrder?: (orderId: number) => Promise<void>;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (txId: number) => Promise<void>;
  onAddToPrintQueue: (customer: Customer) => void;
  onDeleteCustomer: (id: number) => Promise<void>;
  showCountryField?: boolean;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  transactions,
  orders = [],
  onOpenCustomerModal,
  onOpenTransactionWithCustomer,
  onOpenOrderWithCustomer,
  onOpenReceivePaymentModal,
  onEditOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onEditTransaction,
  onDeleteTransaction,
  onAddToPrintQueue,
  onDeleteCustomer,
  showCountryField = false,
}) => {
  const { tr, translateOrderStatus, translatePaymentMethod, translateCategory } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'orders' | 'paid' | 'profit' | 'name'>(
    'balance'
  );
  const [filterMode, setFilterMode] = useState<'ALL' | 'OWES_BALANCE' | 'SETTLED'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [ledgerModalCustomer, setLedgerModalCustomer] = useState<Customer | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<'orders' | 'payments' | 'shipping'>('orders');
  const [justQueuedId, setJustQueuedId] = useState<number | null>(null);

  // Compute complete orders, payments, unpaid balance, and shipping per customer
  const customerStats = useMemo(() => {
    const stats: Record<
      number,
      {
        ordersBilled: number;
        paymentsReceived: number;
        unpaidBalance: number;
        shipping: number;
        profit: number;
        orderCount: number;
        unpaidOrderCount: number;
        paymentCount: number;
        ordersList: CustomerOrder[];
        paymentsList: Transaction[];
        shippingList: Transaction[];
        allHistory: Transaction[];
      }
    > = {};

    customers.forEach((c) => {
      if (c.id) {
        stats[c.id] = {
          ordersBilled: 0,
          paymentsReceived: 0,
          unpaidBalance: 0,
          shipping: 0,
          profit: 0,
          orderCount: 0,
          unpaidOrderCount: 0,
          paymentCount: 0,
          ordersList: [],
          paymentsList: [],
          shippingList: [],
          allHistory: [],
        };
      }
    });

    // 1. Aggregate Customer Orders
    orders.forEach((o) => {
      if (o.customerId && stats[o.customerId]) {
        stats[o.customerId].ordersList.push(o);
        if (o.status !== 'Cancelled') {
          const info = getOrderPaymentInfo(o);
          stats[o.customerId].ordersBilled += info.total;
          stats[o.customerId].unpaidBalance += info.remaining;
          stats[o.customerId].orderCount += 1;
          if (info.remaining > 0.01) {
            stats[o.customerId].unpaidOrderCount += 1;
          }
        }
      }
    });

    // 2. Aggregate Customer Payments & Shipping Costs from Finances
    transactions.forEach((t) => {
      if (t.customerId && stats[t.customerId]) {
        stats[t.customerId].allHistory.push(t);
        const amt = Number(t.amount) || 0;
        if (t.type === 'Income') {
          stats[t.customerId].paymentsReceived += amt;
          stats[t.customerId].paymentCount += 1;
          stats[t.customerId].paymentsList.push(t);
        } else {
          stats[t.customerId].shipping += amt;
          stats[t.customerId].shippingList.push(t);
        }
      }
    });

    Object.keys(stats).forEach((idKey) => {
      const id = Number(idKey);
      const st = stats[id];
      // If legacy income transactions exist without corresponding CustomerOrder records, ensure ordersBilled reflects at least paymentsReceived + unpaidBalance
      st.ordersBilled = Math.max(st.ordersBilled, st.paymentsReceived + st.unpaidBalance);
      st.profit = st.paymentsReceived - st.shipping;

      st.ordersList.sort(
        (a, b) =>
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime() ||
          b.timestamp - a.timestamp
      );
      st.paymentsList.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.timestamp - a.timestamp
      );
      st.shippingList.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() ||
          b.timestamp - a.timestamp
      );
    });

    return stats;
  }, [customers, transactions, orders]);

  // Global summary across all customers
  const globalTotals = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalUnpaidDue = 0;
    let customersWithDebt = 0;

    Object.values(customerStats).forEach((st) => {
      totalBilled += st.ordersBilled;
      totalPaid += st.paymentsReceived;
      totalUnpaidDue += st.unpaidBalance;
      if (st.unpaidBalance > 0.01) {
        customersWithDebt += 1;
      }
    });

    return { totalBilled, totalPaid, totalUnpaidDue, customersWithDebt };
  }, [customerStats]);

  // Filtered & sorted list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        const st = c.id ? customerStats[c.id] : null;
        if (filterMode === 'OWES_BALANCE' && (!st || st.unpaidBalance <= 0.01)) {
          return false;
        }
        if (filterMode === 'SETTLED' && st && st.unpaidBalance > 0.01) {
          return false;
        }

        const query = searchTerm.toLowerCase();
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const comp = (c.company || '').toLowerCase();
        const city = (c.city || '').toLowerCase();
        const country = (c.country || '').toLowerCase();
        return (
          fullName.includes(query) ||
          comp.includes(query) ||
          city.includes(query) ||
          country.includes(query)
        );
      })
      .sort((a, b) => {
        const statsA = a.id ? customerStats[a.id] : null;
        const statsB = b.id ? customerStats[b.id] : null;

        if (sortBy === 'balance') {
          const diff = (statsB?.unpaidBalance || 0) - (statsA?.unpaidBalance || 0);
          if (Math.abs(diff) > 0.01) return diff;
          return (statsB?.ordersBilled || 0) - (statsA?.ordersBilled || 0);
        }
        if (sortBy === 'orders') {
          return (statsB?.ordersBilled || 0) - (statsA?.ordersBilled || 0);
        }
        if (sortBy === 'paid') {
          return (statsB?.paymentsReceived || 0) - (statsA?.paymentsReceived || 0);
        }
        if (sortBy === 'profit') {
          return (statsB?.profit || 0) - (statsA?.profit || 0);
        }
        return `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        );
      });
  }, [customers, customerStats, searchTerm, sortBy, filterMode]);

  const handleQueueClick = (customer: Customer) => {
    onAddToPrintQueue(customer);
    if (customer.id) {
      setJustQueuedId(customer.id);
      setTimeout(() => setJustQueuedId(null), 1500);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedStats = selectedCustomer?.id
    ? customerStats[selectedCustomer.id]
    : null;

  return (
    <div className="space-y-6">
      {/* 1. TOP CUSTOMER RECEIVABLES & PAYMENTS KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>{tr('Total Customer Accounts', 'إجمالي حسابات الزبائن')}</span>
            <span className="font-mono text-slate-300">
              {customers.length} {tr('Clients', 'زبون')}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1.5">
            €{globalTotals.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {tr(
              'Total cumulative orders billed across all customers',
              'إجمالي قيمة الطلبيات المنفذة لجميع الزبائن'
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-emerald-900/40 shadow-xs">
          <div className="text-xs text-emerald-400 font-semibold flex items-center justify-between">
            <span>{tr('Total Payments Received', 'إجمالي الدفعات المستلمة')}</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1.5">
            +€{globalTotals.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {tr(
              'Total payments collected from customers',
              'مجموع المبالغ المحصلة من الزبائن'
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-rose-900/50 shadow-xs">
          <div className="text-xs text-rose-400 font-semibold flex items-center justify-between">
            <span>{tr('Unpaid Customer Balances Due', 'ذمم الزبائن غير المدفوعة')}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {globalTotals.customersWithDebt} {tr('Clients Due', 'زبون مدين')}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1.5">
            €{globalTotals.totalUnpaidDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {tr(
              'Receivables owed by customers for unpaid/partial orders',
              'المبالغ المتبقية بذمة الزبائن للطلبيات الآجلة'
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 flex flex-col justify-between shadow-xs">
          <div className="text-xs text-slate-300 font-semibold">
            {tr('Quick Customer Account Actions', 'إجراءات سريعة لحسابات الزبائن')}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {onOpenReceivePaymentModal && (
              <button
                onClick={() => onOpenReceivePaymentModal(customers[0]?.id || 0)}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{tr('Receive Payment', 'تلقي دفعة')}</span>
              </button>
            )}
            <button
              onClick={() => onOpenCustomerModal()}
              className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{tr('+ Client', '+ زبون جديد')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP CONTROLS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141820] p-4 rounded-xl border border-slate-800">
        {/* Search & Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr(
                'Search by customer name, company, or city...',
                'ابحث باسم الزبون، الشركة، أو المدينة...'
              )}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {tr('All', 'الكل')} ({customers.length})
            </button>
            <button
              onClick={() => setFilterMode('OWES_BALANCE')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'OWES_BALANCE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-rose-300 border border-rose-500/30 hover:bg-rose-950/40'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                {tr('Has Unpaid Balance', 'عليه رصيد متبقٍ')} ({globalTotals.customersWithDebt})
              </span>
            </button>
            <button
              onClick={() => setFilterMode('SETTLED')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                filterMode === 'SETTLED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {tr('Settled', 'خالص الذمة')}
            </button>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{tr('Sort by:', 'ترتيب حسب:')}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="balance">
              {tr('Highest Unpaid Balance Due', 'الأعلى رصيداً متبقياً (ذمم)')}
            </option>
            <option value="orders">
              {tr('Highest Total Orders Billed', 'الأعلى إجمالي طلبيات')}
            </option>
            <option value="paid">
              {tr('Highest Payments Received', 'الأعلى دفعات مستلمة')}
            </option>
            <option value="profit">
              {tr('Highest Net Margin', 'الأعلى صافي ربح')}
            </option>
            <option value="name">{tr('Customer Name', 'اسم الزبون')}</option>
          </select>
        </div>
      </div>

      {/* 3. MAIN GRID: CUSTOMERS TABLE + SELECTED CUSTOMER ORDERS & PAYMENTS DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="rounded-xl bg-[#141820] border border-slate-800 overflow-hidden shadow-xs">
            {filteredCustomers.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                {searchTerm
                  ? tr(
                      'No customers matched your search query.',
                      'لم يتم العثور على زبائن مطابقين لبحثك.'
                    )
                  : tr(
                      'No customers match the active filter.',
                      'لا يوجد زبائن ضمن هذا الفلتر.'
                    )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4 font-semibold text-start">
                        {tr('Customer & Account', 'الزبون والحساب')}
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-end">
                        {tr('Orders Billed', 'إجمالي الطلبيات')}
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-end">
                        {tr('Payments Received', 'الدفعات المستلمة')}
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-end">
                        {tr('Unpaid Balance Due', 'الرصيد المتبقي')}
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-center">
                        {tr('Orders & Payments', 'الطلبات والدفعات')}
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-end">
                        {tr('Quick Actions', 'إجراءات سريعة')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCustomers.map((c) => {
                      const stat = c.id ? customerStats[c.id] : null;
                      const billed = stat?.ordersBilled || 0;
                      const paid = stat?.paymentsReceived || 0;
                      const unpaid = stat?.unpaidBalance || 0;
                      const isSelected = selectedCustomerId === c.id;
                      const isQueuedSuccess = justQueuedId === c.id;

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                            isSelected ? 'bg-slate-800/60 border-l-2 border-rose-500' : ''
                          }`}
                          onClick={() =>
                            setSelectedCustomerId(isSelected ? null : c.id || null)
                          }
                        >
                          {/* Name & Company */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-200 text-sm">
                              {c.firstName} {c.lastName}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              {c.company && (
                                <span className="text-slate-300 font-medium">
                                  {c.company} ·
                                </span>
                              )}
                              <span>{c.city}</span>
                              {showCountryField && <span>({c.country})</span>}
                            </div>
                          </td>

                          {/* Orders Billed */}
                          <td className="py-3.5 px-4 text-end font-mono font-medium tabular-nums text-white">
                            <div>
                              €{billed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {stat?.orderCount || 0} {tr('orders', 'طلبيات')}
                            </div>
                          </td>

                          {/* Payments Received */}
                          <td className="py-3.5 px-4 text-end font-mono font-semibold tabular-nums text-emerald-400">
                            <div>
                              +€{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {stat?.paymentCount || 0} {tr('payments', 'دفعات')}
                            </div>
                          </td>

                          {/* Unpaid Balance Due */}
                          <td className="py-3.5 px-4 text-end font-mono tabular-nums">
                            {unpaid > 0.01 ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <AlertCircle className="w-3 h-3" /> €
                                  {unpaid.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                <div className="text-[10px] text-rose-400 mt-0.5">
                                  {stat?.unpaidOrderCount} {tr('unpaid order(s)', 'طلبية غير مسددة')}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> €0.00 {tr('Settled', 'مسدد')}
                              </span>
                            )}
                          </td>

                          {/* Open Full Orders & Payments Statement Modal */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setLedgerModalCustomer(c)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                              title={tr(
                                'View all orders, payments, and account statement for this customer',
                                'عرض جميع طلبيات ودفعات وكشف حساب هذا الزبون'
                              )}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>{tr('Orders & Payments', 'الطلبات والدفعات')}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td
                            className="py-3.5 px-4 text-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {onOpenReceivePaymentModal && c.id && (
                                <button
                                  onClick={() => onOpenReceivePaymentModal(c.id!)}
                                  title={tr(
                                    'Receive payment from customer',
                                    'تلقي دفعة من الزبون لموازنة الرصيد'
                                  )}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                    unpaid > 0.01
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                                      : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  <Wallet className="w-3 h-3" />
                                  <span>{tr('Pay', 'دفعة')}</span>
                                </button>
                              )}

                              {onOpenOrderWithCustomer && c.id && (
                                <button
                                  onClick={() => onOpenOrderWithCustomer(c.id!)}
                                  title={tr(
                                    'Create New Order (Paid or Unpaid)',
                                    'إنشاء طلبية جديدة (مدفوعة أو آجلة)'
                                  )}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Package className="w-3 h-3 text-sky-400" />
                                  <span>{tr('+ Order', '+ طلبية')}</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleQueueClick(c)}
                                title={tr(
                                  'Add Customer Label to Print Queue',
                                  'إضافة بوليصة عنوان الزبون لطابور الطباعة'
                                )}
                                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                                  isQueuedSuccess
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                                }`}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => onOpenCustomerModal(c)}
                                title={tr('Edit Customer Details', 'تعديل بيانات الزبون')}
                                className="p-1.5 text-slate-400 hover:text-sky-400 rounded-md hover:bg-slate-800 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    c.id &&
                                    window.confirm(
                                      tr(
                                        `Delete customer ${c.firstName} ${c.lastName}?`,
                                        `هل أنت متأكد من حذف الزبون ${c.firstName} ${c.lastName}؟`
                                      )
                                    )
                                  ) {
                                    onDeleteCustomer(c.id);
                                    if (selectedCustomerId === c.id) setSelectedCustomerId(null);
                                  }
                                }}
                                title={tr('Delete Customer', 'حذف الزبون')}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 cursor-pointer"
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
        </div>

        {/* Selected Customer Side Panel: Dedicated Orders & Payments Inspector */}
        {selectedCustomer && (
          <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  {tr('Customer Account', 'حساب الزبون')} #{selectedCustomer.id}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                {selectedCustomer.company && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{selectedCustomer.company}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLedgerModalCustomer(selectedCustomer)}
                  className="px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{tr('Full View', 'كشف كامل')}</span>
                </button>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  {tr('Close', 'إغلاق')}
                </button>
              </div>
            </div>

            {/* Address & Contact Box */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div>{selectedCustomer.address}</div>
                  <div className="font-semibold text-slate-200">
                    {selectedCustomer.postalCode} {selectedCustomer.city}
                  </div>
                </div>
              </div>
              {selectedCustomer.phone && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              )}
              {selectedCustomer.email && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{selectedCustomer.email}</span>
                </div>
              )}
            </div>

            {/* Customer Balance & Financial Summary Cards */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">
                  {tr('Total Orders', 'إجمالي الطلبات')}
                </div>
                <div className="text-sm font-bold font-mono text-white mt-0.5">
                  €{(selectedStats?.ordersBilled || 0).toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">
                  {tr('Paid Total', 'المدفوع')}
                </div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  +€{(selectedStats?.paymentsReceived || 0).toFixed(2)}
                </div>
              </div>
              <div
                className={`p-2.5 rounded-lg border ${
                  (selectedStats?.unpaidBalance || 0) > 0.01
                    ? 'bg-rose-950/30 border-rose-800/60'
                    : 'bg-emerald-950/20 border-emerald-800/40'
                }`}
              >
                <div className="text-slate-300 text-[10px] font-semibold">
                  {tr('Balance Due', 'الرصيد المتبقي')}
                </div>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 ${
                    (selectedStats?.unpaidBalance || 0) > 0.01
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  €{(selectedStats?.unpaidBalance || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons: Receive Payment & New Order */}
            <div className="grid grid-cols-2 gap-2">
              {onOpenReceivePaymentModal && selectedCustomer.id && (
                <button
                  onClick={() => onOpenReceivePaymentModal(selectedCustomer.id!)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{tr('+ Receive Payment', '+ تلقي دفعة')}</span>
                </button>
              )}
              {onOpenOrderWithCustomer && selectedCustomer.id && (
                <button
                  onClick={() => onOpenOrderWithCustomer(selectedCustomer.id!)}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{tr('+ New Order', '+ طلبية جديدة')}</span>
                </button>
              )}
            </div>

            {/* Side Panel Sub-Tabs: Orders vs Payments vs Shipping */}
            <div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-[11px] mb-3">
                <button
                  onClick={() => setSidePanelTab('orders')}
                  className={`py-1.5 rounded font-semibold transition-colors cursor-pointer ${
                    sidePanelTab === 'orders'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tr('Orders', 'الطلبات')} ({selectedStats?.ordersList.length || 0})
                </button>
                <button
                  onClick={() => setSidePanelTab('payments')}
                  className={`py-1.5 rounded font-semibold transition-colors cursor-pointer ${
                    sidePanelTab === 'payments'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tr('Payments', 'الدفعات')} ({selectedStats?.paymentsList.length || 0})
                </button>
                <button
                  onClick={() => setSidePanelTab('shipping')}
                  className={`py-1.5 rounded font-semibold transition-colors cursor-pointer ${
                    sidePanelTab === 'shipping'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tr('Shipping', 'الشحن')} ({selectedStats?.shippingList.length || 0})
                </button>
              </div>

              {/* TAB 1: CUSTOMER ORDERS */}
              {sidePanelTab === 'orders' && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {!selectedStats || selectedStats.ordersList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      {tr('No orders recorded for this customer.', 'لا توجد طلبيات مسجلة لهذا الزبون.')}
                    </p>
                  ) : (
                    selectedStats.ordersList.map((ord) => {
                      const payInfo = getOrderPaymentInfo(ord);
                      return (
                        <div
                          key={ord.id}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white">
                                {ord.orderNumber}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-sky-300 border border-slate-700">
                                {translateOrderStatus(ord.status)}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-white">
                              €{payInfo.total.toFixed(2)}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 truncate">
                            {ord.itemsDescription}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              {payInfo.paymentStatus === 'Paid' ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> {tr('Paid in Full', 'مدفوعة بالكامل')}
                                </span>
                              ) : payInfo.paymentStatus === 'Partially Paid' ? (
                                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {tr('Paid', 'مدفوع')} €{payInfo.paid.toFixed(2)} ·
                                  {tr('Due', 'متبقٍ')} €{payInfo.remaining.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3" /> {tr('Unpaid · Due', 'غير مدفوعة · متبقٍ')} €
                                  {payInfo.remaining.toFixed(2)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {payInfo.remaining > 0.01 &&
                                onOpenReceivePaymentModal &&
                                selectedCustomer.id && (
                                  <button
                                    onClick={() =>
                                      onOpenReceivePaymentModal(selectedCustomer.id!, ord.id)
                                    }
                                    className="px-1.5 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 font-semibold cursor-pointer"
                                  >
                                    {tr('Pay', 'سداد')}
                                  </button>
                                )}
                              {onEditOrder && (
                                <button
                                  onClick={() => onEditOrder(ord)}
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                                  title={tr('Edit order', 'تعديل الطلبية')}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: CUSTOMER PAYMENTS */}
              {sidePanelTab === 'payments' && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {!selectedStats || selectedStats.paymentsList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      {tr('No payments recorded for this customer yet.', 'لا توجد دفعات مسجلة لهذا الزبون بعد.')}
                    </p>
                  ) : (
                    selectedStats.paymentsList.map((pay) => (
                      <div
                        key={pay.id}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-slate-200 font-medium truncate max-w-[165px]">
                            {pay.description}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {pay.date} ·{' '}
                            {pay.paymentMethod
                              ? translatePaymentMethod(pay.paymentMethod)
                              : translateCategory(pay.category)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-400">
                            +€{pay.amount.toFixed(2)}
                          </span>
                          {onEditTransaction && (
                            <button
                              onClick={() => onEditTransaction(pay)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SHIPPING EXPENSES */}
              {sidePanelTab === 'shipping' && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  <div className="flex justify-end mb-1">
                    <button
                      onClick={() =>
                        selectedCustomer.id &&
                        onOpenTransactionWithCustomer(selectedCustomer.id)
                      }
                      className="text-[11px] font-medium text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      {tr('+ Add Shipping / Expense', '+ إضافة تكلفة شحن / مصروف')}
                    </button>
                  </div>
                  {!selectedStats || selectedStats.shippingList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      {tr('No shipping expenses recorded for this customer.', 'لا توجد مصاريف شحن مسجلة لهذا الزبون.')}
                    </p>
                  ) : (
                    selectedStats.shippingList.map((shp) => (
                      <div
                        key={shp.id}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-slate-200 font-medium truncate max-w-[165px]">
                            {shp.description}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {shp.date} · {tr('Local Shipping', 'شحن محلي')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-rose-400">
                            -€{shp.amount.toFixed(2)}
                          </span>
                          {onEditTransaction && (
                            <button
                              onClick={() => onEditTransaction(shp)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full Customer Orders, Payments & Account Statement Modal */}
      <CustomerLedgerModal
        isOpen={!!ledgerModalCustomer}
        onClose={() => setLedgerModalCustomer(null)}
        customer={ledgerModalCustomer}
        orders={orders}
        transactions={transactions}
        onOpenNewOrder={(cId) => {
          setLedgerModalCustomer(null);
          if (onOpenOrderWithCustomer) onOpenOrderWithCustomer(cId);
        }}
        onOpenReceivePayment={(cId, oId) => {
          if (onOpenReceivePaymentModal) onOpenReceivePaymentModal(cId, oId);
        }}
        onOpenNewExpense={(cId) => {
          setLedgerModalCustomer(null);
          onOpenTransactionWithCustomer(cId);
        }}
        onEditOrder={(ord) => {
          if (onEditOrder) onEditOrder(ord);
        }}
        onUpdateOrderStatus={async (oId, st) => {
          if (onUpdateOrderStatus) await onUpdateOrderStatus(oId, st);
        }}
        onDeleteOrder={async (oId) => {
          if (onDeleteOrder) await onDeleteOrder(oId);
        }}
        onEditTransaction={(tx) => {
          if (onEditTransaction) onEditTransaction(tx);
        }}
        onDeleteTransaction={async (txId) => {
          if (onDeleteTransaction) await onDeleteTransaction(txId);
        }}
      />
    </div>
  );
};
