import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Download,
  Trash2,
  Edit2,
  TrendingUp,
  Receipt,
  Package,
  Truck,
  Building2,
  Layers,
  Filter,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import type {
  Customer,
  Transaction,
  TransactionCategory,
  Supplier,
  SupplierTransaction,
  CustomerOrder,
  OrderStatus,
} from '../types';
import { getOrderPaymentInfo } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

export type MasterSectionTab =
  | 'ALL'
  | 'ORDERS'
  | 'SUPPLIER_GOODS'
  | 'PACKAGING'
  | 'SHIPPING'
  | 'OWNER_PERSONAL'
  | 'OPERATING';

interface UnifiedLedgerItem {
  uid: string;
  source: 'order' | 'supplier_tx' | 'finance_tx';
  rawId: number;
  date: string;
  timestamp: number;
  section: MasterSectionTab;
  badgeLabel: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  partyName: string;
  customerId?: number | null;
  supplierId?: number | null;
  reference: string;
  amount: number;
  isPositive: boolean;
  orderObj?: CustomerOrder;
  supplierTxObj?: SupplierTransaction;
  financeTxObj?: Transaction;
}

interface FinancesViewProps {
  transactions: Transaction[];
  customers: Customer[];
  suppliers?: Supplier[];
  supplierTransactions?: SupplierTransaction[];
  orders?: CustomerOrder[];
  onOpenTransactionModal: (
    defaultCategory?: TransactionCategory,
    editingTx?: Transaction
  ) => void;
  onDeleteTransaction: (id: number) => Promise<void>;
  onOpenOrderModal?: (orderToEdit?: CustomerOrder, prefilledCustomerId?: number) => void;
  onOpenReceivePaymentModal?: (customerId?: number, orderId?: number) => void;
  onUpdateOrderStatus?: (orderId: number, status: OrderStatus) => Promise<void>;
  onDeleteOrder?: (id: number) => Promise<void>;
  onOpenSupplierTransactionModal?: (
    supplierId?: number,
    defaultType?: 'Bill' | 'Payment',
    suggestedAmount?: number,
    editingTx?: SupplierTransaction
  ) => void;
  onDeleteSupplierTransaction?: (id: number) => Promise<void>;
}

const ORDER_STATUSES: OrderStatus[] = [
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export const FinancesView: React.FC<FinancesViewProps> = ({
  transactions,
  customers,
  suppliers = [],
  supplierTransactions = [],
  orders = [],
  onOpenTransactionModal,
  onDeleteTransaction,
  onOpenOrderModal,
  onOpenReceivePaymentModal,
  onUpdateOrderStatus,
  onDeleteOrder,
  onOpenSupplierTransactionModal,
  onDeleteSupplierTransaction,
}) => {
  const {
    tr,
    translateCategory,
    translateOrderStatus,
    translatePaymentStatus,
    translatePaymentMethod,
  } = useI18n();

  const [activeSection, setActiveSection] = useState<MasterSectionTab>('ALL');
  const [chartRange, setChartRange] = useState<'30D' | '90D' | 'ALL'>('30D');

  // Comprehensive Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<'ALL' | '7D' | '30D' | '90D' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

  const customerMap = useMemo(() => {
    const map: Record<number, Customer> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [customers]);

  const supplierMap = useMemo(() => {
    const map: Record<number, Supplier> = {};
    suppliers.forEach((s) => {
      if (s.id) map[s.id] = s;
    });
    return map;
  }, [suppliers]);

  const linkedFinanceOrderMap = useMemo(() => {
    const map: Record<number, CustomerOrder> = {};
    orders.forEach((o) => {
      if (o.financeTransactionId) {
        map[o.financeTransactionId] = o;
      }
    });
    return map;
  }, [orders]);

  // Build Unified Master Operations List
  const unifiedOperations = useMemo(() => {
    const list: UnifiedLedgerItem[] = [];

    // 1. All Customer Orders
    orders.forEach((o) => {
      if (!o.id) return;
      const cust = customerMap[o.customerId];
      const custName = cust
        ? `${cust.firstName} ${cust.lastName}${cust.company ? ` (${cust.company})` : ''}`
        : o.customerName || `${tr('Customer', 'زبون')} #${o.customerId}`;

      const trackBadge = o.trackingNumber
        ? `${o.carrier || 'DHL'}: ${o.trackingNumber}`
        : o.carrier || tr('Pending Carrier', 'بانتظار الشحن');

      const payInfo = getOrderPaymentInfo(o);
      const payLabel =
        payInfo.paymentStatus === 'Paid'
          ? tr('Paid', 'مدفوعة')
          : payInfo.paymentStatus === 'Partially Paid'
          ? `${tr('Partial', 'جزئي')} (${tr('Due', 'متبقي')} €${payInfo.remaining.toFixed(0)})`
          : `${tr('Unpaid', 'غير مدفوعة')} (${tr('Due', 'متبقي')} €${payInfo.remaining.toFixed(0)})`;

      list.push({
        uid: `order-${o.id}`,
        source: 'order',
        rawId: o.id,
        date: o.orderDate,
        timestamp: o.timestamp,
        section: 'ORDERS',
        badgeLabel: `${tr('Order', 'طلبية')} · ${translateOrderStatus(o.status)} · ${payLabel}`,
        badgeColor:
          payInfo.paymentStatus === 'Unpaid'
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : payInfo.paymentStatus === 'Partially Paid'
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : o.status === 'Shipped' || o.status === 'Delivered'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        title: `${o.orderNumber} — ${o.itemsDescription}`,
        subtitle: `${tr('Payment:', 'الدفع:')} ${translatePaymentStatus(
          payInfo.paymentStatus
        )} (${tr('Paid', 'المدفوع')} €${payInfo.paid.toFixed(2)} / ${tr(
          'Due',
          'المتبقي'
        )} €${payInfo.remaining.toFixed(2)}) · ${tr('Status:', 'الحالة:')} ${translateOrderStatus(
          o.status
        )}`,
        partyName: custName,
        customerId: o.customerId,
        reference: trackBadge,
        amount: Number(o.amount) || 0,
        isPositive: true,
        orderObj: o,
      });
    });

    // 2. All Supplier Bills & Payments
    supplierTransactions.forEach((st) => {
      if (!st.id) return;
      const sup = supplierMap[st.supplierId];
      const supName = sup ? sup.name : `${tr('Supplier', 'مورد')} #${st.supplierId}`;
      const isBill = st.type === 'Bill';

      list.push({
        uid: `suptx-${st.id}`,
        source: 'supplier_tx',
        rawId: st.id,
        date: st.date,
        timestamp: st.timestamp,
        section: 'SUPPLIER_GOODS',
        badgeLabel: isBill
          ? tr('Supplier Goods Bill', 'فاتورة شراء بضاعة (مورد)')
          : tr('Supplier Payment', 'دفعة مسددة لمورد'),
        badgeColor: isBill
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        title: st.description,
        subtitle: isBill
          ? tr(
              'Merchandise & inventory purchase on account (Payable +)',
              'شراء بضاعة ومخزون على الحساب (زيادة ذمة المورد)'
            )
          : `${tr('Supplier debt settlement', 'تسديد دفعة لحساب المورد')} (${translatePaymentMethod(
              st.paymentMethod || 'Bank Transfer'
            )})`,
        partyName: supName,
        supplierId: st.supplierId,
        reference: st.referenceInvoice || '—',
        amount: Number(st.amount) || 0,
        isPositive: !isBill,
        supplierTxObj: st,
      });
    });

    // 3. All Financial Ledger Transactions
    transactions.forEach((t) => {
      if (!t.id) return;
      if (linkedFinanceOrderMap[t.id]) {
        return;
      }

      const cust = t.customerId ? customerMap[t.customerId] : null;
      const custName = cust
        ? `${cust.firstName} ${cust.lastName}${cust.company ? ` (${cust.company})` : ''}`
        : tr('Warehouse / General', 'المستودع / عام');

      let sec: MasterSectionTab = 'OPERATING';
      let badgeLabel: string = translateCategory(t.category);
      let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';

      if (t.category === 'Owner Capital Injection') {
        sec = 'OWNER_PERSONAL';
        badgeLabel = tr('Owner Capital Injection (+€)', 'إيداع من المال الخاص (+€)');
        badgeColor = 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      } else if (t.category === 'Personal Withdrawal') {
        sec = 'OWNER_PERSONAL';
        badgeLabel = tr('Personal Withdrawal (-€)', 'سحب شخصي (-€)');
        badgeColor = 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      } else if (
        t.category === 'Order Revenue' ||
        t.category === 'Customer Payment' ||
        t.type === 'Income'
      ) {
        sec = 'ORDERS';
        badgeLabel =
          t.category === 'Customer Payment'
            ? tr('Customer Payment', 'دفعة زبون (تسديد رصيد)')
            : t.category === 'Order Revenue'
            ? tr('Order Revenue', 'إيراد طلبية')
            : tr('Other Income', 'إيرادات أخرى');
        badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      } else if (t.category === 'Goods/Inventory') {
        sec = 'SUPPLIER_GOODS';
        badgeLabel = tr('Direct Goods Purchase', 'شراء بضاعة مباشر');
        badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      } else if (t.category === 'Packaging & Supplies') {
        sec = 'PACKAGING';
        badgeLabel = tr('Packaging & Supplies', 'شراء مواد تغليف');
        badgeColor = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      } else if (t.category === 'Shipping') {
        sec = 'SHIPPING';
        badgeLabel = tr('Local Parcel Shipping', 'تكلفة شحن محلي');
        badgeColor = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      } else {
        sec = 'OPERATING';
        badgeLabel = translateCategory(t.category);
        badgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      }

      const partyDisplay =
        t.category === 'Owner Capital Injection'
          ? tr('Owner Personal Funds', 'المال الخاص (إيداع مالك)')
          : t.category === 'Personal Withdrawal'
          ? tr('Owner Personal Draw', 'سحب شخصي (مسحوبات مالك)')
          : custName;

      list.push({
        uid: `fintx-${t.id}`,
        source: 'finance_tx',
        rawId: t.id,
        date: t.date,
        timestamp: t.timestamp,
        section: sec,
        badgeLabel,
        badgeColor,
        title: t.description,
        subtitle: `${t.type === 'Income' ? tr('Income', 'وارد') : tr('Expense', 'منصرف')} · ${
          t.category === 'Shipping'
            ? tr('Standard Local Ground Carrier', 'شحن بري محلي قياسي')
            : t.category === 'Owner Capital Injection'
            ? tr('Cash injected from personal funds', 'إضافة نقود من المال الخاص إلى رصيد العمل')
            : t.category === 'Personal Withdrawal'
            ? tr('Cash withdrawn for personal use', 'سحب نقود للاستخدام الشخصي من رصيد العمل')
            : translateCategory(t.category)
        }${t.paymentMethod ? ` (${translatePaymentMethod(t.paymentMethod)})` : ''}`,
        partyName: partyDisplay,
        customerId: t.customerId,
        reference: t.invoiceNumber || '—',
        amount: Number(t.amount) || 0,
        isPositive: t.type === 'Income',
        financeTxObj: t,
      });
    });

    return list.sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        b.timestamp - a.timestamp
    );
  }, [
    orders,
    supplierTransactions,
    transactions,
    customerMap,
    supplierMap,
    linkedFinanceOrderMap,
    tr,
    translateCategory,
    translateOrderStatus,
    translatePaymentStatus,
    translatePaymentMethod,
  ]);

  // Section Totals & Counts
  const sectionStats = useMemo(() => {
    let ordersTotal = 0;
    let ordersCount = 0;
    let supplierGoodsBills = 0;
    let supplierPayments = 0;
    let supplierGoodsCount = 0;
    let packagingTotal = 0;
    let packagingCount = 0;
    let shippingTotal = 0;
    let shippingCount = 0;
    let ownerAddedTotal = 0;
    let ownerWithdrawnTotal = 0;
    let ownerPersonalCount = 0;
    let operatingTotal = 0;
    let operatingCount = 0;

    unifiedOperations.forEach((item) => {
      if (item.section === 'ORDERS') {
        if (item.orderObj?.status !== 'Cancelled') {
          ordersTotal += item.amount;
        }
        ordersCount += 1;
      } else if (item.section === 'SUPPLIER_GOODS') {
        supplierGoodsCount += 1;
        if (item.supplierTxObj?.type === 'Payment') {
          supplierPayments += item.amount;
        } else {
          supplierGoodsBills += item.amount;
        }
      } else if (item.section === 'PACKAGING') {
        packagingTotal += item.amount;
        packagingCount += 1;
      } else if (item.section === 'SHIPPING') {
        shippingTotal += item.amount;
        shippingCount += 1;
      } else if (item.section === 'OWNER_PERSONAL') {
        ownerPersonalCount += 1;
        if (item.isPositive) {
          ownerAddedTotal += item.amount;
        } else {
          ownerWithdrawnTotal += item.amount;
        }
      } else if (item.section === 'OPERATING') {
        operatingTotal += item.amount;
        operatingCount += 1;
      }
    });

    return {
      ordersTotal,
      ordersCount,
      supplierGoodsBills,
      supplierPayments,
      supplierGoodsCount,
      packagingTotal,
      packagingCount,
      shippingTotal,
      shippingCount,
      ownerAddedTotal,
      ownerWithdrawnTotal,
      ownerNetFlow: ownerAddedTotal - ownerWithdrawnTotal,
      ownerPersonalCount,
      operatingTotal,
      operatingCount,
      totalCount: unifiedOperations.length,
    };
  }, [unifiedOperations]);

  // Apply Multi-Variable Filters
  const filteredOperations = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    return unifiedOperations.filter((item) => {
      if (activeSection !== 'ALL' && item.section !== activeSection) {
        return false;
      }

      if (datePreset !== 'ALL') {
        const itemDate = new Date(item.date);
        if (datePreset === '7D') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          if (itemDate < cutoff) return false;
        } else if (datePreset === '30D') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          if (itemDate < cutoff) return false;
        } else if (datePreset === '90D') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);
          if (itemDate < cutoff) return false;
        } else if (datePreset === 'CUSTOM') {
          if (startDate && itemDate < new Date(startDate)) return false;
          if (endDate && itemDate > new Date(endDate)) return false;
        }
      }

      if (customerFilter !== 'ALL' && String(item.customerId || '') !== customerFilter) {
        return false;
      }

      if (supplierFilter !== 'ALL' && String(item.supplierId || '') !== supplierFilter) {
        return false;
      }

      if (carrierFilter !== 'ALL') {
        const cLow = carrierFilter.toLowerCase();
        const ordCarrier = (item.orderObj?.carrier || '').toLowerCase();
        const titleLow = item.title.toLowerCase();
        const refLow = item.reference.toLowerCase();
        if (!ordCarrier.includes(cLow) && !titleLow.includes(cLow) && !refLow.includes(cLow)) {
          return false;
        }
      }

      if (orderStatusFilter !== 'ALL') {
        if (!item.orderObj || item.orderObj.status !== orderStatusFilter) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSub = item.subtitle.toLowerCase().includes(q);
        const matchParty = item.partyName.toLowerCase().includes(q);
        const matchRef = item.reference.toLowerCase().includes(q);
        const matchBadge = item.badgeLabel.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchParty && !matchRef && !matchBadge) {
          return false;
        }
      }

      return true;
    });
  }, [
    unifiedOperations,
    activeSection,
    datePreset,
    startDate,
    endDate,
    customerFilter,
    supplierFilter,
    carrierFilter,
    orderStatusFilter,
    searchTerm,
  ]);

  // Multi-Line SVG Trend Chart Data across Dates
  const trendData = useMemo(() => {
    const dateMap: Record<
      string,
      {
        rawDate: string;
        label: string;
        ordersAmt: number;
        supplierAmt: number;
        packagingAmt: number;
        shippingAmt: number;
        ownerAddedAmt: number;
        ownerWithdrawnAmt: number;
        operatingAmt: number;
      }
    > = {};

    unifiedOperations.forEach((op) => {
      const d = new Date(op.date);
      const label = isNaN(d.getTime()) ? op.date : `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dateMap[op.date]) {
        dateMap[op.date] = {
          rawDate: op.date,
          label,
          ordersAmt: 0,
          supplierAmt: 0,
          packagingAmt: 0,
          shippingAmt: 0,
          ownerAddedAmt: 0,
          ownerWithdrawnAmt: 0,
          operatingAmt: 0,
        };
      }
      if (op.section === 'ORDERS') dateMap[op.date].ordersAmt += op.amount;
      else if (op.section === 'SUPPLIER_GOODS') dateMap[op.date].supplierAmt += op.amount;
      else if (op.section === 'PACKAGING') dateMap[op.date].packagingAmt += op.amount;
      else if (op.section === 'SHIPPING') dateMap[op.date].shippingAmt += op.amount;
      else if (op.section === 'OWNER_PERSONAL') {
        if (op.isPositive) dateMap[op.date].ownerAddedAmt += op.amount;
        else dateMap[op.date].ownerWithdrawnAmt += op.amount;
      } else dateMap[op.date].operatingAmt += op.amount;
    });

    const sorted = Object.values(dateMap).sort(
      (a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
    );
    const sliceCount = chartRange === '30D' ? 8 : chartRange === '90D' ? 12 : 18;
    const recent = sorted.slice(-sliceCount);

    if (recent.length === 0) {
      return [
        {
          rawDate: '-',
          label: 'D1',
          ordersAmt: 0,
          supplierAmt: 0,
          packagingAmt: 0,
          shippingAmt: 0,
          ownerAddedAmt: 0,
          ownerWithdrawnAmt: 0,
          operatingAmt: 0,
        },
        {
          rawDate: '-',
          label: 'D2',
          ordersAmt: 0,
          supplierAmt: 0,
          packagingAmt: 0,
          shippingAmt: 0,
          ownerAddedAmt: 0,
          ownerWithdrawnAmt: 0,
          operatingAmt: 0,
        },
      ];
    }
    return recent;
  }, [unifiedOperations, chartRange]);

  const chartW = 720;
  const chartH = 155;
  const padX = 46;
  const padY = 22;

  const maxTrendVal = Math.max(
    ...trendData.map((d) =>
      activeSection === 'ORDERS'
        ? d.ordersAmt
        : activeSection === 'SUPPLIER_GOODS'
        ? d.supplierAmt
        : activeSection === 'PACKAGING'
        ? d.packagingAmt
        : activeSection === 'SHIPPING'
        ? d.shippingAmt
        : activeSection === 'OWNER_PERSONAL'
        ? Math.max(d.ownerAddedAmt, d.ownerWithdrawnAmt)
        : activeSection === 'OPERATING'
        ? d.operatingAmt
        : Math.max(
            d.ordersAmt,
            d.supplierAmt,
            d.packagingAmt,
            d.shippingAmt,
            d.ownerAddedAmt,
            d.ownerWithdrawnAmt
          )
    ),
    100
  );

  const buildPath = (extractor: (d: (typeof trendData)[0]) => number) => {
    const pts = trendData.map((d, i) => {
      const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
      const val = extractor(d);
      const y = chartH - padY - (val / maxTrendVal) * (chartH - padY * 2);
      return { x, y, val, label: d.label };
    });
    const path = pts.length ? `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '';
    return { pts, path };
  };

  const ordersCurve = buildPath((d) => d.ordersAmt);
  const supplierCurve = buildPath((d) => d.supplierAmt);
  const packagingCurve = buildPath((d) => d.packagingAmt);
  const shippingCurve = buildPath((d) => d.shippingAmt);
  const ownerAddedCurve = buildPath((d) => d.ownerAddedAmt);
  const ownerWithdrawnCurve = buildPath((d) => d.ownerWithdrawnAmt);
  const operatingCurve = buildPath((d) => d.operatingAmt);

  // Export Filtered Master Operations to CSV
  const handleExportMasterCSV = () => {
    if (filteredOperations.length === 0) return;

    const headers = [
      'Date',
      'Section',
      'Operation Type',
      'Account / Party',
      'Description / Items',
      'Reference / Tracking',
      'Order Status',
      'Amount (EUR)',
    ];

    const rows = filteredOperations.map((item) => [
      item.date,
      item.section,
      `"${item.badgeLabel.replace(/"/g, '""')}"`,
      `"${item.partyName.replace(/"/g, '""')}"`,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.reference.replace(/"/g, '""')}"`,
      item.orderObj?.status || '-',
      `${item.isPositive ? '+' : '-'}${item.amount.toFixed(2)}`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Master_Operations_Ledger_${activeSection}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Context-Aware Edit Handler
  const handleEditOperation = (item: UnifiedLedgerItem) => {
    if (item.source === 'order' && item.orderObj && onOpenOrderModal) {
      onOpenOrderModal(item.orderObj);
    } else if (
      item.source === 'supplier_tx' &&
      item.supplierTxObj &&
      onOpenSupplierTransactionModal
    ) {
      onOpenSupplierTransactionModal(
        item.supplierTxObj.supplierId,
        item.supplierTxObj.type,
        undefined,
        item.supplierTxObj
      );
    } else if (item.source === 'finance_tx' && item.financeTxObj) {
      onOpenTransactionModal(item.financeTxObj.category, item.financeTxObj);
    }
  };

  // Context-Aware Delete Handler
  const handleDeleteOperation = async (item: UnifiedLedgerItem) => {
    if (
      !window.confirm(
        tr(
          `Delete operation "${item.title}" (€${item.amount.toFixed(2)})?`,
          `هل أنت متأكد من حذف العملية "${item.title}" (€${item.amount.toFixed(2)})؟`
        )
      )
    ) {
      return;
    }
    if (item.source === 'order' && onDeleteOrder) {
      await onDeleteOrder(item.rawId);
    } else if (item.source === 'supplier_tx' && onDeleteSupplierTransaction) {
      await onDeleteSupplierTransaction(item.rawId);
    } else if (item.source === 'finance_tx') {
      await onDeleteTransaction(item.rawId);
    }
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setCustomerFilter('ALL');
    setSupplierFilter('ALL');
    setCarrierFilter('ALL');
    setOrderStatusFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* 1. DEDICATED SECTION CARDS / TABS                                 */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* All Operations */}
        <button
          onClick={() => setActiveSection('ALL')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'ALL'
              ? 'bg-rose-600/15 border-rose-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
            <span>{tr('All Operations', 'جميع العمليات')}</span>
            <Receipt className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {sectionStats.totalCount}{' '}
            <span className="text-xs font-normal text-slate-400">
              {tr('Records', 'سجل')}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {tr('Master Unified Ledger', 'السجل الموحد الشامل')}
          </div>
        </button>

        {/* Customer Orders Section */}
        <button
          onClick={() => setActiveSection('ORDERS')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'ORDERS'
              ? 'bg-emerald-600/15 border-emerald-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 mb-1">
            <span>{tr('Orders & Status', 'الطلبيات والدفعات')}</span>
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            €{sectionStats.ordersTotal.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sectionStats.ordersCount} {tr('Customer Orders', 'طلبيات ودفعات')}
          </div>
        </button>

        {/* Supplier Goods Purchases Section */}
        <button
          onClick={() => setActiveSection('SUPPLIER_GOODS')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'SUPPLIER_GOODS'
              ? 'bg-rose-600/15 border-rose-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-400 mb-1">
            <span>{tr('Supplier Goods', 'بضاعة الموردين')}</span>
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-rose-400">
            €{sectionStats.supplierGoodsBills.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sectionStats.supplierGoodsCount} {tr('Bills & Settlements', 'فواتير ودفعات')}
          </div>
        </button>

        {/* Packaging & Supplies Section */}
        <button
          onClick={() => setActiveSection('PACKAGING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'PACKAGING'
              ? 'bg-purple-600/15 border-purple-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-purple-400 mb-1">
            <span>{tr('Packaging Buy', 'مواد التغليف')}</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-purple-400">
            €{sectionStats.packagingTotal.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sectionStats.packagingCount} {tr('Packaging Batches', 'مشتريات تغليف')}
          </div>
        </button>

        {/* Local Parcel Shipping Section */}
        <button
          onClick={() => setActiveSection('SHIPPING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'SHIPPING'
              ? 'bg-sky-600/15 border-sky-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-sky-400 mb-1">
            <span>{tr('Local Shipping', 'تكاليف الشحن')}</span>
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-sky-400">
            €{sectionStats.shippingTotal.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sectionStats.shippingCount} {tr('Local Parcel Vouchers', 'بوالص شحن محلي')}
          </div>
        </button>

        {/* Owner Personal Funds & Withdrawals Section */}
        <button
          onClick={() => setActiveSection('OWNER_PERSONAL')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'OWNER_PERSONAL'
              ? 'bg-teal-600/15 border-teal-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-teal-400 mb-1">
            <span>{tr('Owner & Draws', 'المال الخاص والسحب')}</span>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div
            className={`text-lg font-bold font-mono ${
              sectionStats.ownerNetFlow >= 0 ? 'text-teal-400' : 'text-orange-400'
            }`}
          >
            {sectionStats.ownerNetFlow >= 0 ? '+' : ''}€{sectionStats.ownerNetFlow.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            +€{sectionStats.ownerAddedTotal.toFixed(0)} / -€{sectionStats.ownerWithdrawnTotal.toFixed(0)}
          </div>
        </button>

        {/* Operating & Facility Expenses Section */}
        <button
          onClick={() => setActiveSection('OPERATING')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeSection === 'OPERATING'
              ? 'bg-amber-600/15 border-amber-500 shadow-sm'
              : 'bg-[#141820] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400 mb-1">
            <span>{tr('Facility & Ops', 'مصاريف المستودع')}</span>
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono text-amber-400">
            €{sectionStats.operatingTotal.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sectionStats.operatingCount} {tr('Operating Entries', 'قيد تشغيلي')}
          </div>
        </button>
      </div>

      {/* ================================================================= */}
      {/* 2. MULTI-LINE SVG TREND CHART                                     */}
      {/* ================================================================= */}
      <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                {activeSection === 'ALL' &&
                  tr(
                    'Master Operations Trend Lines (Orders, Supplier Goods, Packaging, Local Shipping & Personal Funds)',
                    'المنحنيات البيانية الشاملة للعمليات (الطلبيات، الموردين، التغليف، الشحن، والمال الخاص)'
                  )}
                {activeSection === 'ORDERS' &&
                  tr(
                    'Customer Orders & Consignment Revenue Trend Line',
                    'المنحنى البياني لطلبيات الزبائن والدفعات المحصلة'
                  )}
                {activeSection === 'SUPPLIER_GOODS' &&
                  tr(
                    'Supplier Goods Purchases & Inventory Settlements Trend Line',
                    'المنحنى البياني لمشتريات بضاعة الموردين والدفعات'
                  )}
                {activeSection === 'PACKAGING' &&
                  tr(
                    'Packaging Materials & Cartons Expenditure Trend Line',
                    'المنحنى البياني لمشتريات مواد التغليف والكراتين'
                  )}
                {activeSection === 'SHIPPING' &&
                  tr(
                    'Standard Local Parcel Shipping Expenditure Trend Line',
                    'المنحنى البياني لتكاليف شحن الطرود المحلية'
                  )}
                {activeSection === 'OWNER_PERSONAL' &&
                  tr(
                    'Owner Personal Capital Injections (+€) vs Personal Cash Withdrawals (-€) Trend Line',
                    'المنحنى البياني للإيداعات من المال الخاص (+€) مقابل المسحوبات الشخصية (-€)'
                  )}
                {activeSection === 'OPERATING' &&
                  tr(
                    'Warehouse Facility, Vehicle & Administrative Cost Trend Line',
                    'المنحنى البياني لمصاريف المستودع والمركبات والتشغيل'
                  )}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {tr(
                'Visual trajectory across recorded dates — switch tabs above to isolate any specific operation stream',
                'مسار العمليات عبر التواريخ المسجلة — اختر أي قسم بالأعلى لعرض بياناته ومنحناه الخاص'
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            {(['30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  chartRange === r
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === 'ALL' ? tr('ALL', 'الكل') : r}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-40 text-slate-600 overflow-visible"
          >
            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const y = chartH - padY - frac * (chartH - padY * 2);
              return (
                <g key={idx}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={chartW - padX}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padX - 6}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="end"
                    className="font-mono"
                  >
                    €{Math.round(maxTrendVal * frac)}
                  </text>
                </g>
              );
            })}

            <line
              x1={padX}
              y1={chartH - padY}
              x2={chartW - padX}
              y2={chartH - padY}
              stroke="#334155"
              strokeWidth="1"
            />

            {(activeSection === 'ALL' || activeSection === 'ORDERS') &&
              ordersCurve.path && (
                <path
                  d={ordersCurve.path}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

            {(activeSection === 'ALL' || activeSection === 'SUPPLIER_GOODS') &&
              supplierCurve.path && (
                <path
                  d={supplierCurve.path}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

            {(activeSection === 'ALL' || activeSection === 'PACKAGING') &&
              packagingCurve.path && (
                <path
                  d={packagingCurve.path}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
              )}

            {(activeSection === 'ALL' || activeSection === 'SHIPPING') &&
              shippingCurve.path && (
                <path
                  d={shippingCurve.path}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="3 2"
                />
              )}

            {(activeSection === 'ALL' || activeSection === 'OWNER_PERSONAL') &&
              ownerAddedCurve.path && (
                <path
                  d={ownerAddedCurve.path}
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

            {(activeSection === 'ALL' || activeSection === 'OWNER_PERSONAL') &&
              ownerWithdrawnCurve.path && (
                <path
                  d={ownerWithdrawnCurve.path}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
              )}

            {activeSection === 'OPERATING' && operatingCurve.path && (
              <path
                d={operatingCurve.path}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {trendData.map((d, idx) => {
              const x =
                padX + (idx * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
              return (
                <text
                  key={idx}
                  x={x}
                  y={chartH - 5}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {d.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Chart Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-emerald-500 rounded-full" />
              {tr('Orders', 'الطلبيات')} (€{sectionStats.ordersTotal.toFixed(0)})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-rose-500 rounded-full" />
              {tr('Supplier Goods', 'بضاعة الموردين')} (€{sectionStats.supplierGoodsBills.toFixed(0)})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-purple-500 rounded-full" />
              {tr('Packaging', 'التغليف')} (€{sectionStats.packagingTotal.toFixed(0)})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-sky-500 rounded-full" />
              {tr('Local Shipping', 'الشحن المحلي')} (€{sectionStats.shippingTotal.toFixed(0)})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-teal-400 rounded-full" />
              {tr('+Personal Funds', '+المال الخاص')} (€{sectionStats.ownerAddedTotal.toFixed(0)})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-1 bg-orange-400 rounded-full" />
              {tr('-Personal Draw', '-سحب شخصي')} (€{sectionStats.ownerWithdrawnTotal.toFixed(0)})
            </span>
          </div>
          <span className="font-mono text-slate-400">
            {tr('Showing', 'عرض')}{' '}
            <strong className="text-white">{filteredOperations.length}</strong>{' '}
            {tr('matching entries', 'عملية مطابقة')}
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. CONTEXT-AWARE QUICK ADD BAR + ADVANCED FILTERING TOOLS         */}
      {/* ================================================================= */}
      <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <PlusCircle className="w-4 h-4 text-rose-500" />
            <span>
              {tr(
                'Unified Operations & Accounting Actions:',
                'إجراءات المحاسبة والعمليات الموحدة:'
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenTransactionModal()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {tr(
                  '+ Record Entry (Income / Expense)',
                  '+ تسجيل قيد جديد (إيراد / مصروف)'
                )}
              </span>
            </button>

            {onOpenOrderModal && (
              <button
                onClick={() => onOpenOrderModal()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tr('+ New Customer Order', '+ طلبية زبون جديدة')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Second Row: Search & Multi-Variable Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr(
                'Search order #, invoice, tracking #, item, client, supplier...',
                'ابحث برقم الطلبية، الفاتورة، رقم التتبع، الصنف، الزبون، أو المورد...'
              )}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">{tr('All Customers', 'كل الزبائن')}</option>
            {customers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.firstName} {c.lastName} ({c.city})
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">{tr('All Goods Suppliers', 'كل موردي البضاعة')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">{tr('All Local Carriers', 'كل شركات الشحن')}</option>
            <option value="DHL">DHL Paket</option>
            <option value="DPD">DPD Standard</option>
            <option value="Hermes">Hermes</option>
            <option value="GLS">GLS</option>
            <option value="UPS">UPS Standard</option>
          </select>

          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">{tr('All Order Statuses', 'كل حالات الطلبيات')}</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {tr('Status:', 'الحالة:')} {translateOrderStatus(st)}
              </option>
            ))}
          </select>
        </div>

        {/* Third Row: Date Range Presets + Custom Dates + Reset & Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-rose-400" />{' '}
              {tr('Date Filter:', 'فلتر التاريخ:')}
            </span>
            {(['ALL', '7D', '30D', '90D', 'CUSTOM'] as const).map((dp) => (
              <button
                key={dp}
                onClick={() => setDatePreset(dp)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  datePreset === dp
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {dp === 'ALL'
                  ? tr('All Dates', 'كل التواريخ')
                  : dp === 'CUSTOM'
                  ? tr('Custom Range', 'فترة مخصصة')
                  : dp}
              </button>
            ))}

            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
                <span className="text-slate-500">{tr('to', 'إلى')}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{tr('Reset Filters', 'إعادة ضبط الفلاتر')}</span>
            </button>

            <button
              onClick={handleExportMasterCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{tr('Export CSV', 'تصدير CSV')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. MASTER OPERATIONS LEDGER TABLE                                 */}
      {/* ================================================================= */}
      <div className="rounded-xl bg-[#141820] border border-slate-800 shadow-xs overflow-hidden">
        {filteredOperations.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">
              {tr(
                'No operations match your active filters',
                'لا توجد عمليات مطابقة للفلاتر المحددة'
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {tr(
                'Use the quick add buttons above to record a customer order, supplier goods bill, packaging purchase, or local shipping voucher.',
                'استخدم أزرار الإضافة السريعة بالأعلى لتسجيل طلبية زبون، فاتورة مورد، شراء مواد تغليف، أو حركة مال خاص.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{tr('Date', 'التاريخ')}</th>
                  <th className="py-3.5 px-4">
                    {tr('Operation Type / Status', 'نوع العملية / الحالة')}
                  </th>
                  <th className="py-3.5 px-4">
                    {tr('Description & Details', 'البيان والتفاصيل')}
                  </th>
                  <th className="py-3.5 px-4">
                    {tr('Customer / Supplier', 'الزبون / المورد / الحساب')}
                  </th>
                  <th className="py-3.5 px-4">
                    {tr('Ref / Local Tracking', 'المرجع / رقم التتبع')}
                  </th>
                  <th className="py-3.5 px-4 text-right">{tr('Amount (€)', 'المبلغ (€)')}</th>
                  <th className="py-3.5 px-4 text-right">
                    {tr('Edit / Delete', 'تعديل / حذف')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredOperations.map((item) => (
                  <tr
                    key={item.uid}
                    className="hover:bg-slate-800/35 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {item.date}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.source === 'order' && item.orderObj && onUpdateOrderStatus ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {tr('Order', 'طلبية')}
                          </span>
                          <select
                            value={item.orderObj.status}
                            onChange={(e) =>
                              item.orderObj?.id &&
                              onUpdateOrderStatus(
                                item.orderObj.id,
                                e.target.value as OrderStatus
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-semibold text-white focus:outline-none cursor-pointer"
                            title={tr('Change Order Status directly', 'تغيير حالة الطلبية مباشرة')}
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {translateOrderStatus(st)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${item.badgeColor}`}
                        >
                          {item.badgeLabel}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.subtitle}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {item.partyName}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {item.reference}
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                        item.isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.isPositive ? '+' : '-'}€{item.amount.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.source === 'order' &&
                          item.orderObj &&
                          onOpenReceivePaymentModal &&
                          getOrderPaymentInfo(item.orderObj).remaining > 0.01 &&
                          item.orderObj.status !== 'Cancelled' && (
                            <button
                              onClick={() =>
                                onOpenReceivePaymentModal(
                                  item.orderObj!.customerId,
                                  item.orderObj!.id
                                )
                              }
                              title={tr(
                                'Receive payment for this order',
                                'استلام دفعة لتسديد هذه الطلبية'
                              )}
                              className="px-2 py-1 text-[10px] font-bold text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Wallet className="w-3 h-3" />
                              <span>{tr('Pay', 'تسديد')}</span>
                            </button>
                          )}

                        <button
                          onClick={() => handleEditOperation(item)}
                          title={tr(
                            'Edit this operation & its type-specific data',
                            'تعديل هذه العملية وبياناتها'
                          )}
                          className="px-2 py-1 text-slate-300 hover:text-white rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-sky-400" />
                          <span className="text-[11px]">{tr('Edit', 'تعديل')}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteOperation(item)}
                          title={tr('Delete operation', 'حذف العملية')}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
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
      </div>
    </div>
  );
};
