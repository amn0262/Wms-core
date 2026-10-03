import React, { useState, useEffect, useCallback } from 'react';
import type { Customer, Transaction, PrintQueueItem, SenderSettings } from './types';
import {
  db,
  getSenderSettings,
  saveSenderSettings,
  DEFAULT_SENDER_SETTINGS,
} from './db';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { FinancesView } from './components/FinancesView';
import { ReportsView } from './components/ReportsView';
import { PrintQueueView } from './components/PrintQueueView';
import { SettingsView } from './components/SettingsView';
import { TransactionModal } from './components/TransactionModal';
import { CustomerModal } from './components/CustomerModal';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Core Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [senderSettings, setSenderSettings] = useState<SenderSettings>(DEFAULT_SENDER_SETTINGS);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionPrefillCustomerId, setTransactionPrefillCustomerId] = useState<number | null>(null);

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Load data from Dexie
  const loadAllData = useCallback(async () => {
    try {
      const allCustomers = await db.customers.toArray();
      const allFinances = await db.finances.toArray();
      const settings = await getSenderSettings();

      setCustomers(allCustomers);
      setTransactions(allFinances);
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

  // Transaction Actions
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
      // Also update any customer reference in print queue
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0d11] text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        printQueueCount={printQueue.reduce((acc, q) => acc + (q.quantity || 1), 0)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        activeCustomerCount={customers.length}
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
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto pb-12">
            {currentView === 'dashboard' && (
              <DashboardView
                customers={customers}
                transactions={transactions}
                printQueueCount={printQueue.reduce((acc, q) => acc + (q.quantity || 1), 0)}
                onOpenTransactionModal={() => {
                  setTransactionPrefillCustomerId(null);
                  setIsTransactionModalOpen(true);
                }}
                onOpenCustomerModal={() => {
                  setEditingCustomer(null);
                  setIsCustomerModalOpen(true);
                }}
                onNavigate={(view) => setCurrentView(view)}
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
                onAddToPrintQueue={handleAddToPrintQueue}
                onDeleteCustomer={handleDeleteCustomer}
                showCountryField={senderSettings.showCountryField ?? false}
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
    </div>
  );
}
