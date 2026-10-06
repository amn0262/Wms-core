import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Edit2,
  Trash2,
  Printer,
  TrendingUp,
  Check,
  RotateCcw,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import type {
  Customer,
  CustomerOrder,
  OrderStatus,
  OrderPaymentStatus,
  CarrierType,
} from '../types';
import { ShipOrderModal } from './ShipOrderModal';
import { getOrderPaymentInfo } from '../utils/financialTheme';

interface OrdersViewProps {
  orders: CustomerOrder[];
  customers: Customer[];
  onOpenOrderModal: (orderToEdit?: CustomerOrder, prefilledCustomerId?: number) => void;
  onOpenReceivePaymentModal?: (customerId?: number, orderId?: number) => void;
  onSaveShipment: (
    orderId: number,
    carrier: CarrierType,
    trackingNumber: string,
    shippedDate: string
  ) => Promise<void>;
  onUpdateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (id: number) => Promise<void>;
  onAddToPrintQueue: (customer: Customer) => void;
}

const ALL_STATUSES: OrderStatus[] = [
  'Processing',
  'Ready for Dispatch',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  customers,
  onOpenOrderModal,
  onOpenReceivePaymentModal,
  onSaveShipment,
  onUpdateOrderStatus,
  onDeleteOrder,
  onAddToPrintQueue,
}) => {
  const [chartRange, setChartRange] = useState<'30D' | '90D' | 'ALL'>('30D');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  >('ALL');
  const [paymentFilter, setPaymentFilter] = useState<
    'ALL' | 'UNPAID_OR_PARTIAL' | 'UNPAID' | 'PARTIAL' | 'PAID'
  >('ALL');
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeShipModalOrder, setActiveShipModalOrder] = useState<CustomerOrder | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Customer Map
  const customerMap = useMemo(() => {
    const map: Record<number, Customer> = {};
    customers.forEach((c) => {
      if (c.id) map[c.id] = c;
    });
    return map;
  }, [customers]);

  // Overall Order & Payment Statistics
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalPaid = 0;
    let totalUnpaidReceivables = 0;
    let unpaidOrPartialCount = 0;
    let pendingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    orders.forEach((o) => {
      if (o.status !== 'Cancelled') {
        const payInfo = getOrderPaymentInfo(o);
        totalValue += payInfo.total;
        totalPaid += payInfo.paid;
        totalUnpaidReceivables += payInfo.remaining;
        if (payInfo.remaining > 0.01) {
          unpaidOrPartialCount += 1;
        }
      }
      if (o.status === 'Processing' || o.status === 'Ready for Dispatch') {
        pendingCount += 1;
      } else if (o.status === 'Shipped') {
        shippedCount += 1;
      } else if (o.status === 'Delivered') {
        deliveredCount += 1;
      } else if (o.status === 'Cancelled') {
        cancelledCount += 1;
      }
    });

    const fulfilledCount = shippedCount + deliveredCount;
    const activeTotal = Math.max(orders.length - cancelledCount, 1);
    const fulfillmentRate = orders.length > 0 ? (fulfilledCount / activeTotal) * 100 : 0;

    return {
      totalOrders: orders.length,
      totalValue,
      totalPaid,
      totalUnpaidReceivables,
      unpaidOrPartialCount,
      pendingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      fulfillmentRate,
    };
  }, [orders]);

  // Orders & Shipments Trend Chart Data
  const trendData = useMemo(() => {
    const dateMap: Record<
      string,
      {
        rawDate: string;
        label: string;
        totalAmount: number;
        paidAmount: number;
        orderCount: number;
      }
    > = {};

    orders.forEach((o) => {
      const dStr = o.orderDate;
      const d = new Date(dStr);
      const label = isNaN(d.getTime()) ? dStr : `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dateMap[dStr]) {
        dateMap[dStr] = {
          rawDate: dStr,
          label,
          totalAmount: 0,
          paidAmount: 0,
          orderCount: 0,
        };
      }
      const payInfo = getOrderPaymentInfo(o);
      dateMap[dStr].orderCount += 1;
      dateMap[dStr].totalAmount += payInfo.total;
      dateMap[dStr].paidAmount += payInfo.paid;
    });

    const sorted = Object.values(dateMap).sort(
      (a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
    );
    const sliceCount = chartRange === '30D' ? 8 : chartRange === '90D' ? 12 : 18;
    const recent = sorted.slice(-sliceCount);

    if (recent.length === 0) {
      return [
        { rawDate: '-', label: 'D1', totalAmount: 0, paidAmount: 0, orderCount: 0 },
        { rawDate: '-', label: 'D2', totalAmount: 0, paidAmount: 0, orderCount: 0 },
      ];
    }
    return recent;
  }, [orders, chartRange]);

  const chartW = 680;
  const chartH = 145;
  const padX = 44;
  const padY = 24;
  const maxTrendVal = Math.max(
    ...trendData.map((d) => Math.max(d.totalAmount, d.paidAmount)),
    100
  );

  const ptsTotal = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.totalAmount / maxTrendVal) * (chartH - padY * 2);
    return { x, y, val: d.totalAmount, label: d.label, count: d.orderCount };
  });

  const ptsPaid = trendData.map((d, i) => {
    const x = padX + (i * (chartW - padX * 2)) / Math.max(trendData.length - 1, 1);
    const y = chartH - padY - (d.paidAmount / maxTrendVal) * (chartH - padY * 2);
    return { x, y, val: d.paidAmount, label: d.label };
  });

  const pathTotal = ptsTotal.length
    ? `M ${ptsTotal.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  const pathPaid = ptsPaid.length
    ? `M ${ptsPaid.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (customerFilter !== 'ALL' && String(o.customerId) !== customerFilter) {
          return false;
        }
        if (carrierFilter !== 'ALL' && o.carrier !== carrierFilter) {
          return false;
        }
        if (startDate && new Date(o.orderDate) < new Date(startDate)) return false;
        if (endDate && new Date(o.orderDate) > new Date(endDate)) return false;

        if (statusFilter === 'PENDING') {
          if (o.status !== 'Processing' && o.status !== 'Ready for Dispatch') return false;
        } else if (statusFilter === 'SHIPPED') {
          if (o.status !== 'Shipped') return false;
        } else if (statusFilter === 'DELIVERED') {
          if (o.status !== 'Delivered') return false;
        } else if (statusFilter === 'CANCELLED') {
          if (o.status !== 'Cancelled') return false;
        }

        // Payment Status Filter
        if (paymentFilter !== 'ALL') {
          const payInfo = getOrderPaymentInfo(o);
          if (paymentFilter === 'UNPAID_OR_PARTIAL' && payInfo.remaining <= 0.01) return false;
          if (paymentFilter === 'UNPAID' && payInfo.paymentStatus !== 'Unpaid') return false;
          if (paymentFilter === 'PARTIAL' && payInfo.paymentStatus !== 'Partially Paid')
            return false;
          if (paymentFilter === 'PAID' && payInfo.paymentStatus !== 'Paid') return false;
        }

        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase();
          const customer = customerMap[o.customerId];
          const custName = customer
            ? `${customer.firstName} ${customer.lastName} ${customer.company || ''}`.toLowerCase()
            : (o.customerName || '').toLowerCase();

          const matchesQuery =
            o.orderNumber.toLowerCase().includes(query) ||
            custName.includes(query) ||
            (o.trackingNumber && o.trackingNumber.toLowerCase().includes(query)) ||
            o.itemsDescription.toLowerCase().includes(query);

          if (!matchesQuery) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime() ||
          b.timestamp - a.timestamp
      );
  }, [
    orders,
    searchTerm,
    statusFilter,
    paymentFilter,
    carrierFilter,
    customerFilter,
    startDate,
    endDate,
    customerMap,
  ]);

  // Helper: Carrier Live Tracking URL
  const getCarrierTrackingUrl = (carrier?: CarrierType, tracking?: string) => {
    if (!tracking) return '#';
    const cleanTrack = encodeURIComponent(tracking.trim());
    switch (carrier) {
      case 'DHL':
        return `https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode=${cleanTrack}`;
      case 'DPD':
        return `https://tracking.dpd.de/status/en_US/parcel/${cleanTrack}`;
      case 'UPS':
        return `https://www.ups.com/track?tracknum=${cleanTrack}`;
      case 'GLS':
        return `https://gls-group.eu/track/${cleanTrack}`;
      case 'Hermes':
        return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsdetails/#${cleanTrack}`;
      default:
        return `https://www.google.com/search?q=${carrier}+tracking+${cleanTrack}`;
    }
  };

  const handleCopyTracking = (tracking: string, id: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-400" />
              Total Orders Value
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {stats.totalOrders} Orders
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            €{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Total value of all executed customer orders
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Paid & Collected
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Cash Received
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            €{stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Payments received upfront or via customer balance settlements
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-rose-900/50 shadow-xs">
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Unpaid Customer Balance
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {stats.unpaidOrPartialCount} Unsettled
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            €{stats.totalUnpaidReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Orders executed on credit awaiting customer payment
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-sky-400" />
              Dispatch & Fulfillment
            </span>
            <span className="text-[11px] font-mono text-amber-400 font-bold">
              {stats.pendingCount} Pending
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">
            {stats.shippedCount + stats.deliveredCount}{' '}
            <span className="text-sm font-normal text-slate-400">Shipped</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.fulfillmentRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. ORDERS VALUE VS COLLECTED PAYMENTS TIMELINE TREND CHART */}
      <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">
                Customer Orders Billed vs. Paid Amount Trend Line
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Total order volume (€) vs collected customer payments (€) across order dates
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            {(['30D', '90D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  chartRange === r
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-36 text-slate-600 overflow-visible"
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
            {pathTotal && (
              <path
                d={pathTotal}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {pathPaid && (
              <path
                d={pathPaid}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
              />
            )}
            {ptsTotal.map((p, idx) => (
              <g key={`ot-${idx}`}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="#0ea5e9" />
                <text
                  x={p.x}
                  y={p.y - 6}
                  fill="#38bdf8"
                  fontSize="8.5"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {p.count} ord
                </text>
                <text
                  x={p.x}
                  y={chartH - 5}
                  fill="#64748b"
                  fontSize="9"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {p.label}
                </text>
              </g>
            ))}
            {ptsPaid.map((p, idx) => (
              <circle key={`os-${idx}`} cx={p.x} cy={p.y} r="3" fill="#10b981" />
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-sky-500 rounded-full" />
              <span className="text-slate-300">
                Total Orders Billed (€{stats.totalValue.toFixed(2)})
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500 rounded-full border-t border-dashed" />
              <span className="text-slate-300">
                Paid Amount (€{stats.totalPaid.toFixed(2)})
              </span>
            </span>
          </div>
          <span className="font-mono text-sky-400 font-semibold">
            Showing {filteredOrders.length} of {orders.length} Orders
          </span>
        </div>
      </div>

      {/* 3. CONTROLS, ADVANCED FILTERS & ACTIONS */}
      <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order #, customer name, local carrier tracking #, or item..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenReceivePaymentModal && (
              <button
                onClick={() => onOpenReceivePaymentModal()}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>+ Receive Customer Payment</span>
              </button>
            )}

            <button
              onClick={() => onOpenOrderModal()}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ New Customer Order (Paid or Unpaid)</span>
            </button>
          </div>
        </div>

        {/* Multi-Variable Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Status & Payment Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 text-[11px]">Dispatch:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending ({stats.pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'SHIPPED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Shipped ({stats.shippedCount})
            </button>

            <span className="text-slate-600 mx-1">|</span>
            <span className="text-slate-400 font-medium mr-1 text-[11px]">Payment:</span>
            <button
              onClick={() =>
                setPaymentFilter(
                  paymentFilter === 'UNPAID_OR_PARTIAL' ? 'ALL' : 'UNPAID_OR_PARTIAL'
                )
              }
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                paymentFilter === 'UNPAID_OR_PARTIAL'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-rose-300 border border-rose-500/30 hover:bg-rose-950/40'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              <span>Unpaid / Balance Due ({stats.unpaidOrPartialCount})</span>
            </button>
            <button
              onClick={() => setPaymentFilter(paymentFilter === 'PAID' ? 'ALL' : 'PAID')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                paymentFilter === 'PAID'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Paid
            </button>
          </div>

          {/* Client, Carrier & Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="ALL">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>

            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="ALL">All Local Carriers</option>
              <option value="DHL">DHL Paket</option>
              <option value="DPD">DPD Standard</option>
              <option value="Hermes">Hermes</option>
              <option value="GLS">GLS</option>
              <option value="UPS">UPS Standard</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="From Date"
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-mono"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="To Date"
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white font-mono"
            />

            {(statusFilter !== 'ALL' ||
              paymentFilter !== 'ALL' ||
              carrierFilter !== 'ALL' ||
              customerFilter !== 'ALL' ||
              startDate ||
              endDate ||
              searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setPaymentFilter('ALL');
                  setCarrierFilter('ALL');
                  setCustomerFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                  setSearchTerm('');
                }}
                className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ORDERS TABLE (WITH PAYMENT STATUS, REMAINING BALANCE & RECEIVE PAYMENT ACTION) */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#141820] border border-slate-800 text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Orders Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create customer orders with immediate payment or on credit (unpaid), assign local carrier tracking numbers, and settle customer balances anytime.
          </p>
          <button
            onClick={() => onOpenOrderModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create First Order</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#141820]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Order # & Date</th>
                <th className="py-3.5 px-4">Customer Account</th>
                <th className="py-3.5 px-4">Goods & Items</th>
                <th className="py-3.5 px-4 text-right">Order Value</th>
                <th className="py-3.5 px-4 text-center">Payment Status & Balance</th>
                <th className="py-3.5 px-4 text-center">Dispatch Status</th>
                <th className="py-3.5 px-4">Local Carrier & Tracking #</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredOrders.map((order) => {
                const customer = customerMap[order.customerId];
                const isShipped = order.status === 'Shipped';
                const isDelivered = order.status === 'Delivered';
                const hasTracking = !!order.trackingNumber;
                const payInfo = getOrderPaymentInfo(order);

                return (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Order # and Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-white font-mono text-sm">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {order.orderDate}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      {customer ? (
                        <div>
                          <div className="font-medium text-slate-200">
                            {customer.firstName} {customer.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {customer.company && (
                              <span className="text-slate-400">{customer.company} ·</span>
                            )}
                            <span>{customer.city}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {order.customerName || 'Customer ID #' + order.customerId}
                        </span>
                      )}
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4">
                      <div
                        className="font-medium text-slate-300 max-w-xs truncate"
                        title={order.itemsDescription}
                      >
                        {order.itemsDescription}
                      </div>
                      {order.notes && (
                        <div
                          className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5"
                          title={order.notes}
                        >
                          Note: {order.notes}
                        </div>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      €
                      {payInfo.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Payment Status & Remaining Balance */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        {payInfo.paymentStatus === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Paid (€{payInfo.paid.toFixed(2)})
                          </span>
                        ) : payInfo.paymentStatus === 'Partially Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="w-3 h-3" /> Partial · Due: €
                            {payInfo.remaining.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3" /> Unpaid · Due: €
                            {payInfo.remaining.toFixed(2)}
                          </span>
                        )}

                        {payInfo.remaining > 0.01 && onOpenReceivePaymentModal && (
                          <button
                            onClick={() =>
                              onOpenReceivePaymentModal(order.customerId, order.id)
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Receive payment from customer for this order"
                          >
                            <Wallet className="w-2.5 h-2.5" />
                            <span>+ Receive Payment</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Interactive Status Selector + Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) =>
                          order.id &&
                          onUpdateOrderStatus(order.id, e.target.value as OrderStatus)
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer ${
                          isShipped
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isDelivered
                            ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40'
                            : order.status === 'Ready for Dispatch'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : order.status === 'Cancelled'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st} className="bg-slate-900 text-white">
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Carrier & Tracking # */}
                    <td className="py-3.5 px-4">
                      {hasTracking ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-sky-400 border border-slate-700">
                              {order.carrier || 'DHL'}
                            </span>
                            <span className="font-mono text-slate-200 text-xs font-semibold">
                              {order.trackingNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              onClick={() =>
                                handleCopyTracking(order.trackingNumber!, `track-${order.id}`)
                              }
                              className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                              title="Copy tracking code"
                            >
                              {copiedId === `track-${order.id}` ? (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Copy className="w-3 h-3" /> Copy
                                </span>
                              )}
                            </button>

                            <a
                              href={getCarrierTrackingUrl(order.carrier, order.trackingNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors"
                              title="Trace on Local Carrier Portal"
                            >
                              <span>Trace</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveShipModalOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Truck className="w-3 h-3 text-amber-400" />
                          <span>+ Add Tracking & Ship</span>
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isShipped && !isDelivered && (
                          <button
                            onClick={() => setActiveShipModalOrder(order)}
                            title="Mark as Shipped with Local Tracking Number"
                            className="px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Ship
                          </button>
                        )}

                        {customer && (
                          <button
                            onClick={() => onAddToPrintQueue(customer)}
                            title="Add Customer Shipping Label to A4 Print Queue"
                            className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onOpenOrderModal(order)}
                          title="Edit order, payment status & details"
                          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (
                              order.id &&
                              window.confirm(`Delete order "${order.orderNumber}"?`)
                            ) {
                              onDeleteOrder(order.id);
                            }
                          }}
                          title="Delete order"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
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

      {/* Ship & Track Modal */}
      <ShipOrderModal
        isOpen={!!activeShipModalOrder}
        onClose={() => setActiveShipModalOrder(null)}
        order={activeShipModalOrder}
        onSaveShipment={onSaveShipment}
      />
    </div>
  );
};
