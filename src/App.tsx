import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Customer,
  Transaction,
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
import { computeFinancialHealth } from './utils/financialTheme';

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

  // Customer Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionPrefillCustomerId, setTransactionPrefillCustomerId] = useState<number | null>(null);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Order Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderPrefillCustomerId, setOrderPrefillCustomerId] = useState<number | null>(null);

  // Supplier Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isSupplierTransactionModalOpen, setIsSupplierTransactionModalOpen] = useState(false);
  const [supplierTxPrefillId, setSupplierTxPrefillId] = useState<number | null>(null);
  const [supplierTxDefaultType, setSupplierTxDefaultType] = useState<SupplierTransactionType>('Bill');
  const [supplierTxSuggestedAmount, setSupplierTxSuggestedAmount] = useState<number | undefined>(undefined);

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
    return computeFinancialHealth(transactions, suppliers, supplierTransactions);
  }, [transactions, suppliers, supplierTransactions]);

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

  // Transaction Actions (Customers/General)
  const handleSaveTransaction = async (
    data: Omit<Transaction, 'id' | 'timestamp'>
  ) => {
    const newTx: Transaction = {
      ...data,
      timestamp: Date.now(),
    };
    const id = await db.finances.add(newTx);
    setTransactions((prev) => [{ ...newTx, id }, ...prev]);
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

  // Order Actions
  const handleSaveOrder = async (
    data: Omit<CustomerOrder, 'id' | 'timestamp'> & { id?: number },
    syncToFinances: boolean
  ) => {
    let financeId = data.financeTransactionId;

    if (syncToFinances && data.amount > 0) {
      const revenueTx: Transaction = {
        type: 'Income',
        category: 'Order Revenue',
        amount: data.amount,
        date: data.orderDate,
        description: `Order ${data.orderNumber}: ${data.itemsDescription}`,
        customerId: data.customerId,
        invoiceNumber: data.orderNumber,
        timestamp: Date.now(),
      };
      financeId = await db.finances.add(revenueTx);
      setTransactions((prev) => [{ ...revenueTx, id: financeId }, ...prev]);
    }

    if (data.id) {
      const existing = orders.find((o) => o.id === data.id);
      const updated: CustomerOrder = {
        ...data,
        id: data.id,
        financeTransactionId: financeId || existing?.financeTransactionId,
        timestamp: existing?.timestamp || Date.now(),
      };
      await db.orders.put(updated);
      setOrders((prev) => prev.map((o) => (o.id === data.id ? updated : o)));
    } else {
      const newOrder: CustomerOrder = {
        ...data,
        financeTransactionId: financeId,
        timestamp: Date.now(),
      };
      const id = await db.orders.add(newOrder);
      setOrders((prev) => [{ ...newOrder, id }, ...prev]);
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
      shippedDate: status === 'Shipped' && !existing.shippedDate ? new Date().toISOString().slice(0, 10) : existing.shippedDate,
    };

    await db.orders.put(updated);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const handleDeleteOrder = async (id: number) => {
    await db.orders.delete(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
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

  // Supplier Transaction Actions
  const handleSaveSupplierTransaction = async (
    data: Omit<SupplierTransaction, 'id' | 'timestamp'>
  ) => {
    const newTx: SupplierTransaction = {
      ...data,
      timestamp: Date.now(),
    };
    const id = await db.supplierTransactions.add(newTx);
    setSupplierTransactions((prev) => [newTx, ...prev].map((t) => (t === newTx ? { ...t, id } : t)));
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
                  onOpenTransactionModal={() => {
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
                  onOpenCustomerModal={(cust) => {
                    setEditingCustomer(cust || null);
                    setIsCustomerModalOpen(true);
                  }}
                  onOpenTransactionWithCustomer={(cId) => {
                    setTransactionPrefillCustomerId(cId);
                    setIsTransactionModalOpen(true);
                  }}
                  onOpenOrderWithCustomer={(cId) => {
                    setEditingOrder(null);
                    setOrderPrefillCustomerId(cId);
                    setIsOrderModalOpen(true);
                  }}
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
                  onOpenTransactionModal={(sId, dType, sAmount) => {
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
                  onOpenTransactionModal={() => {
                    setTransactionPrefillCustomerId(null);
                    setIsTransactionModalOpen(true);
                  }}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {currentView === 'reports' && (
                <ReportsView
                  transactions={transactions}
                  customers={customers}
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
        }}
        onSave={handleSaveTransaction}
        customers={customers}
        prefilledCustomerId={transactionPrefillCustomerId}
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
        }}
        onSave={handleSaveSupplierTransaction}
        suppliers={suppliers}
        prefilledSupplierId={supplierTxPrefillId}
        defaultType={supplierTxDefaultType}
        suggestedAmount={supplierTxSuggestedAmount}
      />
    </div>
  );
}
