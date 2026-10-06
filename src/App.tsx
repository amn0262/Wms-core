import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Customer,
  Transaction,
  TransactionCategory,
  PrintQueueItem,
  SenderSettings,
  Supplier,
  SupplierTransaction,
  SupplierTransactionType,
  CustomerOrder,
  OrderStatus,
  CarrierType,
} from './types';
import {
  db,
  getSenderSettings,
  saveSenderSettings,
  DEFAULT_SENDER_SETTINGS,
} from './db';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { FinancesView } from './components/FinancesView';
import { ReportsView } from './components/ReportsView';
import { PrintQueueView } from './components/PrintQueueView';
import { SettingsView } from './components/SettingsView';
import { TransactionModal } from './components/TransactionModal';
import { CustomerModal } from './components/CustomerModal';
import { SupplierModal } from './components/SupplierModal';
import { SupplierTransactionModal } from './components/SupplierTransactionModal';
import { OrderModal } from './components/OrderModal';
import { CustomerPaymentModal } from './components/CustomerPaymentModal';
import { computeFinancialHealth, getOrderPaymentInfo } from './utils/financialTheme';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [senderSettings, setSenderSettings] = useState<SenderSettings>(DEFAULT_SENDER_SETTINGS);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Transaction Modal State (Create & Edit with Dynamic Category)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionPrefillCustomerId, setTransactionPrefillCustomerId] = useState<number | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [defaultTransactionCategory, setDefaultTransactionCategory] = useState<TransactionCategory | null>(null);

  // Customer Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderPrefillCustomerId, setOrderPrefillCustomerId] = useState<number | null>(null);

  // Customer Payment Modal State (Settle Unpaid Orders / Balance)
  const [isCustomerPaymentModalOpen, setIsCustomerPaymentModalOpen] = useState(false);
  const [paymentPrefillCustomerId, setPaymentPrefillCustomerId] = useState<number | null>(null);
  const [paymentPrefillOrderId, setPaymentPrefillOrderId] = useState<number | null>(null);

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Supplier Transaction Modal State (Create & Edit)
  const [isSupplierTransactionModalOpen, setIsSupplierTransactionModalOpen] = useState(false);
  const [supplierTxPrefillId, setSupplierTxPrefillId] = useState<number | null>(null);
  const [supplierTxDefaultType, setSupplierTxDefaultType] = useState<SupplierTransactionType>('Bill');
  const [supplierTxSuggestedAmount, setSupplierTxSuggestedAmount] = useState<number | undefined>(undefined);
  const [editingSupplierTransaction, setEditingSupplierTransaction] = useState<SupplierTransaction | null>(null);

  // Load all data from Dexie
  const loadAllData = useCallback(async () => {
    try {
      const allCustomers = await db.customers.toArray();
      const allFinances = await db.finances.toArray();
      const allSuppliers = await db.suppliers.toArray();
      const allSupplierTransactions = await db.supplierTransactions.toArray();
      const allOrders = await db.orders.toArray();
      const settings = await getSenderSettings();

      setCustomers(allCustomers);
      setTransactions(allFinances);
      setSuppliers(allSuppliers);
      setSupplierTransactions(allSupplierTransactions);
      setOrders(allOrders);
      setSenderSettings(settings);
    } catch (err) {
      console.error('Error loading Dexie database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Compute Live Financial Health & Graded Theme
  const financialHealth = useMemo(() => {
    return computeFinancialHealth(transactions, suppliers, supplierTransactions, orders);
  }, [transactions, suppliers, supplierTransactions, orders]);

  // Count suppliers with debt owed
  const supplierDebtCount = useMemo(() => {
    const balances: Record<number, number> = {};
    suppliers.forEach((s) => {
      if (s.id) balances[s.id] = 0;
    });
    supplierTransactions.forEach((st) => {
      if (st.supplierId && balances[st.supplierId] !== undefined) {
        if (st.type === 'Bill') balances[st.supplierId] += Number(st.amount) || 0;
        else balances[st.supplierId] -= Number(st.amount) || 0;
      }
    });
    return Object.values(balances).filter((b) => b > 0.01).length;
  }, [suppliers, supplierTransactions]);

  // Count pending orders
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(
      (o) => o.status === 'Processing' || o.status === 'Ready for Dispatch'
    ).length;
  }, [orders]);

  // Transaction Actions (Create & Edit)
  const handleSaveTransaction = async (
    data: Omit<Transaction, 'id' | 'timestamp'> & { id?: number }
  ) => {
    if (data.id) {
      const existing = transactions.find((t) => t.id === data.id);
      const updated: Transaction = {
        ...data,
        id: data.id,
        timestamp: existing?.timestamp || Date.now(),
      };
      await db.finances.put(updated);
      setTransactions((prev) => prev.map((t) => (t.id === data.id ? updated : t)));
    } else {
      const newTx: Transaction = {
        ...data,
        timestamp: Date.now(),
      };
      const id = await db.finances.add(newTx);
      setTransactions((prev) => [{ ...newTx, id }, ...prev]);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    await db.finances.delete(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Customer Actions
  const handleSaveCustomer = async (
    data: Omit<Customer, 'id' | 'created'> & { id?: number }
  ) => {
    if (data.id) {
      const existing = customers.find((c) => c.id === data.id);
      const updated: Customer = {
        ...data,
        id: data.id,
        created: existing?.created || Date.now(),
      };
      await db.customers.put(updated);
      setCustomers((prev) => prev.map((c) => (c.id === data.id ? updated : c)));
      setPrintQueue((prev) =>
        prev.map((item) =>
          item.customer.id === data.id ? { ...item, customer: updated } : item
        )
      );
    } else {
      const newCust: Customer = {
        ...data,
        created: Date.now(),
      };
      const id = await db.customers.add(newCust);
      setCustomers((prev) => [...prev, { ...newCust, id }]);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    await db.customers.delete(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setPrintQueue((prev) => prev.filter((item) => item.customer.id !== id));
  };

  // Order Actions (Create, Edit, Status Update & Sync with Financial Ledger for Paid/Unpaid/Partial Orders)
  const handleSaveOrder = async (
    data: Omit<CustomerOrder, 'id' | 'timestamp'> & { id?: number },
    syncToFinances: boolean
  ) => {
    const initialPaid =
      data.paidAmount !== undefined ? Number(data.paidAmount) || 0 : Number(data.amount) || 0;

    if (data.id) {
      const existing = orders.find((o) => o.id === data.id);
      let linkedFinId = data.financeTransactionId || existing?.financeTransactionId;

      if (linkedFinId) {
        const existingFin = transactions.find((t) => t.id === linkedFinId);
        if (existingFin) {
          if (initialPaid > 0.01) {
            const updatedFin: Transaction = {
              ...existingFin,
              amount: initialPaid,
              date: data.orderDate,
              description: `Order ${data.orderNumber}: ${data.itemsDescription}${
                initialPaid + 0.01 < data.amount ? ' (Partial Payment)' : ''
              }`,
              customerId: data.customerId,
              orderId: data.id,
              invoiceNumber: data.orderNumber,
            };
            await db.finances.put(updatedFin);
            setTransactions((prev) =>
              prev.map((t) => (t.id === linkedFinId ? updatedFin : t))
            );
          } else {
            // Order became Unpaid (0 paid now), remove initial cash receipt
            await db.finances.delete(linkedFinId);
            setTransactions((prev) => prev.filter((t) => t.id !== linkedFinId));
            linkedFinId = undefined;
          }
        }
      } else if (syncToFinances && initialPaid > 0.01) {
        // Was previously unpaid, now has an initial paid amount
        const revenueTx: Transaction = {
          type: 'Income',
          category: 'Order Revenue',
          amount: initialPaid,
          date: data.orderDate,
          description: `Order ${data.orderNumber}: ${data.itemsDescription}${
            initialPaid + 0.01 < data.amount ? ' (Partial Payment)' : ''
          }`,
          customerId: data.customerId,
          orderId: data.id,
          invoiceNumber: data.orderNumber,
          timestamp: Date.now(),
        };
        linkedFinId = await db.finances.add(revenueTx);
        setTransactions((prev) => [{ ...revenueTx, id: linkedFinId }, ...prev]);
      }

      const updated: CustomerOrder = {
        ...data,
        id: data.id,
        financeTransactionId: linkedFinId,
        timestamp: existing?.timestamp || Date.now(),
      };
      await db.orders.put(updated);
      setOrders((prev) => prev.map((o) => (o.id === data.id ? updated : o)));
    } else {
      let financeId = data.financeTransactionId;

      // Only record cash/bank Income in finances for the amount actually paid now!
      // If the order is Unpaid (On Account), paidAmount is 0 so no cash inflow is recorded until payment is received later.
      if (syncToFinances && initialPaid > 0.01) {
        const revenueTx: Transaction = {
          type: 'Income',
          category: 'Order Revenue',
          amount: initialPaid,
          date: data.orderDate,
          description: `Order ${data.orderNumber}: ${data.itemsDescription}${
            initialPaid + 0.01 < data.amount ? ' (Initial Deposit)' : ''
          }`,
          customerId: data.customerId,
          invoiceNumber: data.orderNumber,
          timestamp: Date.now(),
        };
        financeId = await db.finances.add(revenueTx);
        setTransactions((prev) => [{ ...revenueTx, id: financeId }, ...prev]);
      }

      const newOrder: CustomerOrder = {
        ...data,
        financeTransactionId: financeId,
        timestamp: Date.now(),
      };
      const id = await db.orders.add(newOrder);
      setOrders((prev) => [{ ...newOrder, id }, ...prev]);
    }
  };

  // Receive Customer Payment (Settles specific unpaid order or oldest unpaid customer balances)
  const handleReceiveCustomerPayment = async (payload: {
    customerId: number;
    orderId: number | null;
    amount: number;
    date: string;
    paymentMethod: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
    description: string;
    referenceInvoice?: string;
  }) => {
    // 1. Record the payment transaction in finances
    const paymentTx: Transaction = {
      type: 'Income',
      category: 'Customer Payment',
      amount: payload.amount,
      date: payload.date,
      description: payload.description,
      customerId: payload.customerId,
      orderId: payload.orderId,
      invoiceNumber: payload.referenceInvoice,
      paymentMethod: payload.paymentMethod,
      timestamp: Date.now(),
    };
    const txId = await db.finances.add(paymentTx);
    setTransactions((prev) => [{ ...paymentTx, id: txId }, ...prev]);

    // 2. Allocate payment to the specified order OR oldest unpaid orders for this customer
    let remainingToAllocate = payload.amount;
    const updatedOrdersMap: Record<number, CustomerOrder> = {};

    if (payload.orderId) {
      const targetOrder = orders.find((o) => o.id === payload.orderId);
      if (targetOrder && targetOrder.id) {
        const info = getOrderPaymentInfo(targetOrder);
        const applied = Math.min(info.remaining, remainingToAllocate);
        const newPaid = Math.min(info.total, info.paid + applied);
        const newStatus =
          newPaid + 0.01 >= info.total
            ? 'Paid'
            : newPaid > 0.01
            ? 'Partially Paid'
            : 'Unpaid';
        const updatedOrd: CustomerOrder = {
          ...targetOrder,
          paidAmount: newPaid,
          paymentStatus: newStatus,
        };
        await db.orders.put(updatedOrd);
        updatedOrdersMap[targetOrder.id] = updatedOrd;
        remainingToAllocate -= applied;
      }
    }

    // If there is still payment amount left (or general account balance settlement was chosen), settle oldest unpaid orders
    if (remainingToAllocate > 0.01) {
      const custUnpaidOrders = orders
        .filter(
          (o) =>
            o.customerId === payload.customerId &&
            o.status !== 'Cancelled' &&
            o.id !== payload.orderId
        )
        .sort(
          (a, b) =>
            new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime() ||
            a.timestamp - b.timestamp
        );

      for (const ord of custUnpaidOrders) {
        if (remainingToAllocate <= 0.01 || !ord.id) break;
        const info = getOrderPaymentInfo(ord);
        if (info.remaining <= 0.01) continue;

        const applied = Math.min(info.remaining, remainingToAllocate);
        const newPaid = Math.min(info.total, info.paid + applied);
        const newStatus =
          newPaid + 0.01 >= info.total
            ? 'Paid'
            : newPaid > 0.01
            ? 'Partially Paid'
            : 'Unpaid';
        const updatedOrd: CustomerOrder = {
          ...ord,
          paidAmount: newPaid,
          paymentStatus: newStatus,
        };
        await db.orders.put(updatedOrd);
        updatedOrdersMap[ord.id] = updatedOrd;
        remainingToAllocate -= applied;
      }
    }

    if (Object.keys(updatedOrdersMap).length > 0) {
      setOrders((prev) =>
        prev.map((o) => (o.id && updatedOrdersMap[o.id] ? updatedOrdersMap[o.id] : o))
      );
    }
  };

  const handleSaveShipment = async (
    orderId: number,
    carrier: CarrierType,
    trackingNumber: string,
    shippedDate: string
  ) => {
    const existing = orders.find((o) => o.id === orderId);
    if (!existing) return;

    const updated: CustomerOrder = {
      ...existing,
      status: 'Shipped',
      carrier,
      trackingNumber,
      shippedDate,
    };

    await db.orders.put(updated);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleUpdateOrderStatus = async (orderId: number, status: OrderStatus) => {
    const existing = orders.find((o) => o.id === orderId);
    if (!existing) return;

    const updated: CustomerOrder = {
      ...existing,
      status,
      shippedDate:
        status === 'Shipped' && !existing.shippedDate
          ? new Date().toISOString().slice(0, 10)
          : existing.shippedDate,
    };

    await db.orders.put(updated);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleDeleteOrder = async (id: number) => {
    const existing = orders.find((o) => o.id === id);
    await db.orders.delete(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));

    if (existing?.financeTransactionId) {
      await db.finances.delete(existing.financeTransactionId);
      setTransactions((prev) =>
        prev.filter((t) => t.id !== existing.financeTransactionId)
      );
    }
  };

  // Supplier Actions
  const handleSaveSupplier = async (
    data: Omit<Supplier, 'id' | 'created'> & { id?: number }
  ) => {
    if (data.id) {
      const existing = suppliers.find((s) => s.id === data.id);
      const updated: Supplier = {
        ...data,
        id: data.id,
        created: existing?.created || Date.now(),
      };
      await db.suppliers.put(updated);
      setSuppliers((prev) => prev.map((s) => (s.id === data.id ? updated : s)));
    } else {
      const newSupplier: Supplier = {
        ...data,
        created: Date.now(),
      };
      const id = await db.suppliers.add(newSupplier);
      setSuppliers((prev) => [...prev, { ...newSupplier, id }]);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    await db.suppliers.delete(id);
    const relatedTxs = await db.supplierTransactions.where('supplierId').equals(id).toArray();
    for (const r of relatedTxs) {
      if (r.id) await db.supplierTransactions.delete(r.id);
    }
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    setSupplierTransactions((prev) => prev.filter((st) => st.supplierId !== id));
  };

  // Supplier Transaction Actions (Create & Edit)
  const handleSaveSupplierTransaction = async (
    data: Omit<SupplierTransaction, 'id' | 'timestamp'> & { id?: number }
  ) => {
    if (data.id) {
      const existing = supplierTransactions.find((st) => st.id === data.id);
      const updated: SupplierTransaction = {
        ...data,
        id: data.id,
        timestamp: existing?.timestamp || Date.now(),
      };
      await db.supplierTransactions.put(updated);
      setSupplierTransactions((prev) =>
        prev.map((st) => (st.id === data.id ? updated : st))
      );
    } else {
      const newTx: SupplierTransaction = {
        ...data,
        timestamp: Date.now(),
      };
      const id = await db.supplierTransactions.add(newTx);
      setSupplierTransactions((prev) => [{ ...newTx, id }, ...prev]);
    }
  };

  const handleDeleteSupplierTransaction = async (id: number) => {
    await db.supplierTransactions.delete(id);
    setSupplierTransactions((prev) => prev.filter((st) => st.id !== id));
  };

  // Print Queue Actions
  const handleAddToPrintQueue = (customer: Customer) => {
    const newItem: PrintQueueItem = {
      id: `${customer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customer,
      quantity: 1,
    };
    setPrintQueue((prev) => [...prev, newItem]);
  };

  const handleClearPrintQueue = () => {
    setPrintQueue([]);
  };

  // Sender Settings Action
  const handleSaveSenderSettings = async (settings: SenderSettings) => {
    await saveSenderSettings(settings);
    setSenderSettings(settings);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0d11] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono tracking-wider">
            INITIALIZING WMS COMMAND CENTER...
          </span>
        </div>
      </div>
    );
  }

  const isDynamicThemeActive = senderSettings.enableDynamicTheme !== false;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0b0d11] text-slate-100 font-sans">
      {/* Dynamic Ambient Financial Health Aura Line */}
      {isDynamicThemeActive && (
        <div
          className={`h-1 w-full bg-gradient-to-r ${financialHealth.ambientGradient} shrink-0 transition-all duration-700`}
          title={`Financial Status: ${financialHealth.label}`}
        />
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar Navigation */}
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          printQueueCount={printQueue.reduce((acc, q) => acc + (q.quantity || 1), 0)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          activeCustomerCount={customers.length}
          supplierDebtCount={supplierDebtCount}
          pendingOrdersCount={pendingOrdersCount}
          financialHealth={financialHealth}
          enableDynamicTheme={isDynamicThemeActive}
        />

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <Header
            currentView={currentView}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
            onOpenTransactionModal={() => {
              setEditingTransaction(null);
              setDefaultTransactionCategory(null);
              setTransactionPrefillCustomerId(null);
              setIsTransactionModalOpen(true);
            }}
            onOpenCustomerModal={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
            financialHealth={financialHealth}
            enableDynamicTheme={isDynamicThemeActive}
          />

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto pb-12">
              {currentView === 'dashboard' && (
                <DashboardView
                  customers={customers}
                  transactions={transactions}
                  suppliers={suppliers}
                  supplierTransactions={supplierTransactions}
                  orders={orders}
                  financialHealth={financialHealth}
                  printQueueCount={printQueue.reduce((acc, q) => acc + (q.quantity || 1), 0)}
                  onOpenTransactionModal={(defaultCat) => {
                    setEditingTransaction(null);
                    setDefaultTransactionCategory(defaultCat || null);
                    setTransactionPrefillCustomerId(null);
                    setIsTransactionModalOpen(true);
                  }}
                  onOpenCustomerModal={() => {
                    setEditingCustomer(null);
                    setIsCustomerModalOpen(true);
                  }}
                  onOpenOrderModal={() => {
                    setEditingOrder(null);
                    setOrderPrefillCustomerId(null);
                    setIsOrderModalOpen(true);
                  }}
                  onNavigate={(view) => setCurrentView(view)}
                />
              )}

              {currentView === 'orders' && (
                <OrdersView
                  orders={orders}
                  customers={customers}
                  onOpenOrderModal={(orderToEdit, prefilledCustId) => {
                    setEditingOrder(orderToEdit || null);
                    setOrderPrefillCustomerId(prefilledCustId || null);
                    setIsOrderModalOpen(true);
                  }}
                  onOpenReceivePaymentModal={(cId, oId) => {
                    setPaymentPrefillCustomerId(cId || null);
                    setPaymentPrefillOrderId(oId || null);
                    setIsCustomerPaymentModalOpen(true);
                  }}
                  onSaveShipment={handleSaveShipment}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onDeleteOrder={handleDeleteOrder}
                  onAddToPrintQueue={handleAddToPrintQueue}
                />
              )}

              {currentView === 'customers' && (
                <CustomersView
                  customers={customers}
                  transactions={transactions}
                  orders={orders}
                  onOpenCustomerModal={(cust) => {
                    setEditingCustomer(cust || null);
                    setIsCustomerModalOpen(true);
                  }}
                  onOpenTransactionWithCustomer={(cId) => {
                    setEditingTransaction(null);
                    setDefaultTransactionCategory(null);
                    setTransactionPrefillCustomerId(cId);
                    setIsTransactionModalOpen(true);
                  }}
                  onOpenOrderWithCustomer={(cId) => {
                    setEditingOrder(null);
                    setOrderPrefillCustomerId(cId);
                    setIsOrderModalOpen(true);
                  }}
                  onOpenReceivePaymentModal={(cId, oId) => {
                    setPaymentPrefillCustomerId(cId || null);
                    setPaymentPrefillOrderId(oId || null);
                    setIsCustomerPaymentModalOpen(true);
                  }}
                  onEditOrder={(ord) => {
                    setEditingOrder(ord);
                    setOrderPrefillCustomerId(null);
                    setIsOrderModalOpen(true);
                  }}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onDeleteOrder={handleDeleteOrder}
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setDefaultTransactionCategory(tx.category);
                    setTransactionPrefillCustomerId(tx.customerId || null);
                    setIsTransactionModalOpen(true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                  onAddToPrintQueue={handleAddToPrintQueue}
                  onDeleteCustomer={handleDeleteCustomer}
                  showCountryField={senderSettings.showCountryField ?? false}
                />
              )}

              {currentView === 'suppliers' && (
                <SuppliersView
                  suppliers={suppliers}
                  supplierTransactions={supplierTransactions}
                  onOpenSupplierModal={(sup) => {
                    setEditingSupplier(sup || null);
                    setIsSupplierModalOpen(true);
                  }}
                  onOpenTransactionModal={(sId, dType, sAmount, editingTx) => {
                    setEditingSupplierTransaction(editingTx || null);
                    setSupplierTxPrefillId(sId || null);
                    setSupplierTxDefaultType(dType || 'Bill');
                    setSupplierTxSuggestedAmount(sAmount);
                    setIsSupplierTransactionModalOpen(true);
                  }}
                  onDeleteSupplier={handleDeleteSupplier}
                  onDeleteTransaction={handleDeleteSupplierTransaction}
                />
              )}

              {currentView === 'finances' && (
                <FinancesView
                  transactions={transactions}
                  customers={customers}
                  suppliers={suppliers}
                  supplierTransactions={supplierTransactions}
                  orders={orders}
                  onOpenTransactionModal={(defaultCat, editingTx) => {
                    setEditingTransaction(editingTx || null);
                    setDefaultTransactionCategory(defaultCat || null);
                    setTransactionPrefillCustomerId(editingTx?.customerId || null);
                    setIsTransactionModalOpen(true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenOrderModal={(orderToEdit, prefilledCustId) => {
                    setEditingOrder(orderToEdit || null);
                    setOrderPrefillCustomerId(prefilledCustId || null);
                    setIsOrderModalOpen(true);
                  }}
                  onOpenReceivePaymentModal={(cId, oId) => {
                    setPaymentPrefillCustomerId(cId || null);
                    setPaymentPrefillOrderId(oId || null);
                    setIsCustomerPaymentModalOpen(true);
                  }}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onDeleteOrder={handleDeleteOrder}
                  onOpenSupplierTransactionModal={(sId, dType, sAmount, editingTx) => {
                    setEditingSupplierTransaction(editingTx || null);
                    setSupplierTxPrefillId(sId || null);
                    setSupplierTxDefaultType(dType || 'Bill');
                    setSupplierTxSuggestedAmount(sAmount);
                    setIsSupplierTransactionModalOpen(true);
                  }}
                  onDeleteSupplierTransaction={handleDeleteSupplierTransaction}
                />
              )}

              {currentView === 'reports' && (
                <ReportsView
                  transactions={transactions}
                  customers={customers}
                  onEditTransaction={(tx) => {
                    setEditingTransaction(tx);
                    setDefaultTransactionCategory(tx.category);
                    setTransactionPrefillCustomerId(tx.customerId || null);
                    setIsTransactionModalOpen(true);
                  }}
                />
              )}

              {currentView === 'printQueue' && (
                <PrintQueueView
                  queue={printQueue}
                  customers={customers}
                  senderSettings={senderSettings}
                  onUpdateQueue={setPrintQueue}
                  onClearQueue={handleClearPrintQueue}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView
                  senderSettings={senderSettings}
                  onSaveSenderSettings={handleSaveSenderSettings}
                  customers={customers}
                  transactions={transactions}
                  onReloadData={loadAllData}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setTransactionPrefillCustomerId(null);
          setEditingTransaction(null);
          setDefaultTransactionCategory(null);
        }}
        onSave={handleSaveTransaction}
        customers={customers}
        prefilledCustomerId={transactionPrefillCustomerId}
        editingTransaction={editingTransaction}
        defaultCategory={defaultTransactionCategory}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        editingCustomer={editingCustomer}
        showCountryField={senderSettings.showCountryField ?? false}
      />

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          setEditingOrder(null);
          setOrderPrefillCustomerId(null);
        }}
        onSave={handleSaveOrder}
        customers={customers}
        editingOrder={editingOrder}
        prefilledCustomerId={orderPrefillCustomerId}
      />

      <CustomerPaymentModal
        isOpen={isCustomerPaymentModalOpen}
        onClose={() => {
          setIsCustomerPaymentModalOpen(false);
          setPaymentPrefillCustomerId(null);
          setPaymentPrefillOrderId(null);
        }}
        customers={customers}
        orders={orders}
        prefilledCustomerId={paymentPrefillCustomerId}
        prefilledOrderId={paymentPrefillOrderId}
        onReceivePayment={handleReceiveCustomerPayment}
      />

      {/* Supplier Modals */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={handleSaveSupplier}
        editingSupplier={editingSupplier}
      />

      <SupplierTransactionModal
        isOpen={isSupplierTransactionModalOpen}
        onClose={() => {
          setIsSupplierTransactionModalOpen(false);
          setSupplierTxPrefillId(null);
          setSupplierTxSuggestedAmount(undefined);
          setEditingSupplierTransaction(null);
        }}
        onSave={handleSaveSupplierTransaction}
        suppliers={suppliers}
        prefilledSupplierId={supplierTxPrefillId}
        defaultType={supplierTxDefaultType}
        suggestedAmount={supplierTxSuggestedAmount}
        editingTransaction={editingSupplierTransaction}
      />
    </div>
  );
}
