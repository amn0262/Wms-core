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
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { Customer, CustomerOrder, OrderStatus, CarrierType } from '../types';
import { ShipOrderModal } from './ShipOrderModal';

interface OrdersViewProps {
  orders: CustomerOrder[];
  customers: Customer[];
  onOpenOrderModal: (orderToEdit?: CustomerOrder, prefilledCustomerId?: number) => void;
  onSaveShipment: (orderId: number, carrier: CarrierType, trackingNumber: string, shippedDate: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  onDeleteOrder: (id: number) => Promise<void>;
  onAddToPrintQueue: (customer: Customer) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  customers,
  onOpenOrderModal,
  onSaveShipment,
  onUpdateOrderStatus,
  onDeleteOrder,
  onAddToPrintQueue,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SHIPPED' | 'DELIVERED'>('ALL');
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
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

  // Overall Order Statistics
  const stats = useMemo(() => {
    let totalValue = 0;
    let pendingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;

    orders.forEach((o) => {
      totalValue += Number(o.amount) || 0;
      if (o.status === 'Processing' || o.status === 'Ready for Dispatch') {
        pendingCount += 1;
      } else if (o.status === 'Shipped') {
        shippedCount += 1;
      } else if (o.status === 'Delivered') {
        deliveredCount += 1;
      }
    });

    const fulfilledCount = shippedCount + deliveredCount;
    const fulfillmentRate = orders.length > 0 ? (fulfilledCount / orders.length) * 100 : 0;

    return {
      totalOrders: orders.length,
      totalValue,
      pendingCount,
      shippedCount,
      deliveredCount,
      fulfillmentRate,
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
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

        if (carrierFilter !== 'ALL' && o.carrier !== carrierFilter) {
          return false;
        }

        if (statusFilter === 'PENDING') {
          return o.status === 'Processing' || o.status === 'Ready for Dispatch';
        }
        if (statusFilter === 'SHIPPED') {
          return o.status === 'Shipped';
        }
        if (statusFilter === 'DELIVERED') {
          return o.status === 'Delivered';
        }

        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, searchTerm, statusFilter, carrierFilter, customerMap]);

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
        {/* Total Orders & Revenue */}
        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-400" />
              Total Customer Orders
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {stats.totalOrders} Consignments
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            €{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Total gross order revenue across all client accounts
          </p>
        </div>

        {/* Shipped & In Transit */}
        <div className="p-5 rounded-xl bg-[#141820] border border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4" />
              Shipped & Dispatched
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {stats.shippedCount} In Transit
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {stats.shippedCount} <span className="text-sm font-normal text-slate-400">Shipments</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Packages with carrier tracking numbers handed over to freight
          </p>
        </div>

        {/* Pending & Ready for Dispatch */}
        <div className="p-5 rounded-xl bg-[#141820] border border-amber-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Pending Dispatch
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {stats.pendingCount} Due
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {stats.pendingCount} <span className="text-sm font-normal text-slate-400">Orders</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Orders currently in processing or packing on high-bay staging racks
          </p>
        </div>

        {/* Fulfillment Rate */}
        <div className="p-5 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Fulfillment Rate
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {stats.deliveredCount} Delivered
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {stats.fulfillmentRate.toFixed(1)}%
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.fulfillmentRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. CONTROLS, SEARCH & ACTIONS */}
      <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order #, customer name, carrier tracking number, or item..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Action button */}
          <button
            onClick={() => onOpenOrderModal()}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Customer Order</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 text-[11px]">Status:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending Dispatch ({stats.pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'SHIPPED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Shipped / In Transit ({stats.shippedCount})
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'DELIVERED'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Delivered ({stats.deliveredCount})
            </button>
          </div>

          {/* Carrier Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Carrier:</span>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="ALL">All Carriers</option>
              <option value="DHL">DHL</option>
              <option value="DPD">DPD</option>
              <option value="UPS">UPS</option>
              <option value="GLS">GLS</option>
              <option value="Hermes">Hermes</option>
              <option value="Spedition">Spedition</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. ORDERS TABLE */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#141820] border border-slate-800 text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Orders Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'ALL' || carrierFilter !== 'ALL'
              ? 'No orders match your current search filters. Try clearing your query.'
              : 'Create customer orders to track fulfillment status, assign carrier tracking numbers (DHL, DPD, UPS), and link shipments directly to customer accounts.'}
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
                <th className="py-3.5 px-4 text-right">Value (€)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Carrier & Tracking #</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredOrders.map((order) => {
                const customer = customerMap[order.customerId];
                const isShipped = order.status === 'Shipped';
                const isDelivered = order.status === 'Delivered';
                const isPending = order.status === 'Processing' || order.status === 'Ready for Dispatch';
                const hasTracking = !!order.trackingNumber;

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
                            {customer.company && <span className="text-slate-400">{customer.company} ·</span>}
                            <span>{customer.city}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">{order.customerName || 'Customer ID #' + order.customerId}</span>
                      )}
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-300 max-w-xs truncate" title={order.itemsDescription}>
                        {order.itemsDescription}
                      </div>
                      {order.notes && (
                        <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5" title={order.notes}>
                          Note: {order.notes}
                        </div>
                      )}
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      €{(Number(order.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isShipped ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Truck className="w-3 h-3" /> Shipped
                        </span>
                      ) : isDelivered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3" /> Delivered
                        </span>
                      ) : order.status === 'Ready for Dispatch' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" /> Ready to Ship
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          <Clock className="w-3 h-3" /> Processing
                        </span>
                      )}
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
                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyTracking(order.trackingNumber!, `track-${order.id}`)}
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

                            {/* Direct Tracking Portal Link */}
                            <a
                              href={getCarrierTrackingUrl(order.carrier, order.trackingNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors"
                              title="Trace on Carrier Portal"
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
                        {/* Quick Ship button */}
                        {!isShipped && !isDelivered && (
                          <button
                            onClick={() => setActiveShipModalOrder(order)}
                            title="Mark as Shipped with Tracking Number"
                            className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Mark Shipped
                          </button>
                        )}

                        {/* Add to Print Queue */}
                        {customer && (
                          <button
                            onClick={() => onAddToPrintQueue(customer)}
                            title="Add Customer Shipping Label to A4 Print Queue"
                            className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => onOpenOrderModal(order)}
                          title="Edit order"
                          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (order.id && window.confirm(`Delete order "${order.orderNumber}"?`)) {
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
