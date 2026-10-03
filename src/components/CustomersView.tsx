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
} from 'lucide-react';
import type { Customer, Transaction } from '../types';

interface CustomersViewProps {
  customers: Customer[];
  transactions: Transaction[];
  onOpenCustomerModal: (customerToEdit?: Customer) => void;
  onOpenTransactionWithCustomer: (customerId: number) => void;
  onOpenOrderWithCustomer?: (customerId: number) => void;
  onAddToPrintQueue: (customer: Customer) => void;
  onDeleteCustomer: (id: number) => Promise<void>;
  showCountryField?: boolean;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  transactions,
  onOpenCustomerModal,
  onOpenTransactionWithCustomer,
  onOpenOrderWithCustomer,
  onAddToPrintQueue,
  onDeleteCustomer,
  showCountryField = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'profit' | 'shipping'>('revenue');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [justQueuedId, setJustQueuedId] = useState<number | null>(null);

  // Compute profitability and transaction summary per customer
  const customerStats = useMemo(() => {
    const stats: Record<
      number,
      {
        revenue: number;
        shipping: number;
        profit: number;
        orderCount: number;
        history: Transaction[];
      }
    > = {};

    customers.forEach((c) => {
      if (c.id) {
        stats[c.id] = {
          revenue: 0,
          shipping: 0,
          profit: 0,
          orderCount: 0,
          history: [],
        };
      }
    });

    transactions.forEach((t) => {
      if (t.customerId && stats[t.customerId]) {
        stats[t.customerId].history.push(t);
        const amt = Number(t.amount) || 0;
        if (t.type === 'Income') {
          stats[t.customerId].revenue += amt;
          stats[t.customerId].orderCount += 1;
        } else if (t.category === 'Shipping') {
          stats[t.customerId].shipping += amt;
        }
      }
    });

    Object.keys(stats).forEach((idKey) => {
      const id = Number(idKey);
      stats[id].profit = stats[id].revenue - stats[id].shipping;
      // Sort history descending by date
      stats[id].history.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });

    return stats;
  }, [customers, transactions]);

  // Filtered & sorted list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
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

        if (sortBy === 'revenue') {
          return (statsB?.revenue || 0) - (statsA?.revenue || 0);
        }
        if (sortBy === 'profit') {
          return (statsB?.profit || 0) - (statsA?.profit || 0);
        }
        if (sortBy === 'shipping') {
          return (statsB?.shipping || 0) - (statsA?.shipping || 0);
        }
        return `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        );
      });
  }, [customers, customerStats, searchTerm, sortBy]);

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
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, company, city, or country..."
            className="w-full pl-9 pr-4 py-2 bg-[#141820] border border-slate-800 rounded-lg text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Sort & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#141820] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="revenue">Highest Revenue</option>
              <option value="profit">Highest Net Margin</option>
              <option value="shipping">Highest Shipping Costs</option>
              <option value="name">Customer Name</option>
            </select>
          </div>

          <button
            onClick={() => onOpenCustomerModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Customers Table + Drawer / Detail if selected */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="rounded-xl bg-[#141820] border border-slate-800 overflow-hidden shadow-xs">
            {filteredCustomers.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                {searchTerm ? 'No customers matched your search query.' : 'No customers registered yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4 font-semibold">Customer & Account</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      <th className="py-3 px-4 font-semibold text-right">Revenue</th>
                      <th className="py-3 px-4 font-semibold text-right">Shipping Costs</th>
                      <th className="py-3 px-4 font-semibold text-right">Net Profit</th>
                      <th className="py-3 px-4 font-semibold text-center">Label Queue</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCustomers.map((c) => {
                      const stat = c.id ? customerStats[c.id] : null;
                      const rev = stat?.revenue || 0;
                      const ship = stat?.shipping || 0;
                      const profit = stat?.profit || 0;
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
                              <span className="font-mono text-slate-500">ID #{c.id}</span>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-3.5 px-4 text-slate-400">
                            <div>{c.city}</div>
                            {showCountryField && (
                              <div className="text-[11px] text-slate-500 font-medium">
                                {c.country}
                              </div>
                            )}
                          </td>

                          {/* Revenue */}
                          <td className="py-3.5 px-4 text-right font-mono font-medium tabular-nums text-slate-200">
                            €{rev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Shipping */}
                          <td className="py-3.5 px-4 text-right font-mono font-medium tabular-nums text-rose-400">
                            €{ship.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Profit */}
                          <td
                            className={`py-3.5 px-4 text-right font-mono font-bold tabular-nums ${
                              profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            €{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Add to Print Queue */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleQueueClick(c)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                isQueuedSuccess
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700'
                              }`}
                            >
                              {isQueuedSuccess ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Queued!</span>
                                </>
                              ) : (
                                <>
                                  <Printer className="w-3 h-3" />
                                  <span>+ Queue</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {onOpenOrderWithCustomer && (
                                <button
                                  onClick={() => c.id && onOpenOrderWithCustomer(c.id)}
                                  title="Create Order for this customer"
                                  className="p-1.5 text-slate-400 hover:text-purple-400 rounded-md hover:bg-slate-800 cursor-pointer"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => c.id && onOpenTransactionWithCustomer(c.id)}
                                title="Record order / expense for this customer"
                                className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-800"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenCustomerModal(c)}
                                title="Edit Customer Details"
                                className="p-1.5 text-slate-400 hover:text-sky-400 rounded-md hover:bg-slate-800"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (c.id && window.confirm(`Delete customer ${c.firstName} ${c.lastName}?`)) {
                                    onDeleteCustomer(c.id);
                                    if (selectedCustomerId === c.id) setSelectedCustomerId(null);
                                  }
                                }}
                                title="Delete Customer"
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800"
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

        {/* Selected Customer Side Panel */}
        {selectedCustomer && (
          <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  Account File #{selectedCustomer.id}
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
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Close
              </button>
            </div>

            {/* Address & Contact Box */}
            <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div>{selectedCustomer.address}</div>
                  <div className="font-semibold text-slate-200">
                    {selectedCustomer.postalCode} {selectedCustomer.city}
                  </div>
                  {showCountryField && (
                    <div className="text-slate-400">{selectedCustomer.country}</div>
                  )}
                </div>
              </div>

              {selectedCustomer.email && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <a
                    href={`mailto:${selectedCustomer.email}`}
                    className="text-slate-400 hover:text-slate-200 truncate"
                  >
                    {selectedCustomer.email}
                  </a>
                </div>
              )}

              {selectedCustomer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400">{selectedCustomer.phone}</span>
                </div>
              )}

              {selectedCustomer.notes && (
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 italic">
                  Note: {selectedCustomer.notes}
                </div>
              )}
            </div>

            {/* Quick Profitability Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[11px]">Total Revenue</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  €{(selectedStats?.revenue || 0).toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[11px]">Shipping Costs</div>
                <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                  €{(selectedStats?.shipping || 0).toFixed(2)}
                </div>
              </div>
              <div className="col-span-2 p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-[11px]">Net Client Profit</div>
                  <div
                    className={`text-lg font-bold font-mono ${
                      (selectedStats?.profit || 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    €{(selectedStats?.profit || 0).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => handleQueueClick(selectedCustomer)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Queue Label</span>
                </button>
              </div>
            </div>

            {/* Linked Transaction Log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Transaction History
                </h4>
                <button
                  onClick={() =>
                    selectedCustomer.id &&
                    onOpenTransactionWithCustomer(selectedCustomer.id)
                  }
                  className="text-xs font-medium text-rose-400 hover:text-rose-300"
                >
                  + Add Entry
                </button>
              </div>

              {!selectedStats || selectedStats.history.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No orders or shipments recorded.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedStats.history.map((h) => {
                    const isInc = h.type === 'Income';
                    return (
                      <div
                        key={h.id}
                        className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-slate-300 font-medium truncate max-w-[160px]">
                            {h.description}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {h.date} · {h.category}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-bold tabular-nums ${
                            isInc ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isInc ? '+' : '-'}€{h.amount.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
