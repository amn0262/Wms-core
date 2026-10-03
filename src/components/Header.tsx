import React from 'react';
import { Menu, Plus, UserPlus } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onOpenMobileMenu: () => void;
  onOpenTransactionModal: () => void;
  onOpenCustomerModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenMobileMenu,
  onOpenTransactionModal,
  onOpenCustomerModal,
}) => {
  const viewTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Operational Overview',
      subtitle: 'Real-time financial performance and warehouse metrics',
    },
    customers: {
      title: 'Customer Directory & Profitability',
      subtitle: 'Accounts, lifetime revenue, shipping expenditures, and margin analysis',
    },
    finances: {
      title: 'Financial Ledger',
      subtitle: 'Income receipts, inventory restocks, shipping, and facility expenses',
    },
    reports: {
      title: 'Reports & Analytics',
      subtitle: 'Multi-variable filtering, date intervals, and financial statements',
    },
    printQueue: {
      title: 'A4 Multi-Label Print Queue',
      subtitle: 'Batch generation of DIN A4 shipping sheets (6 labels per page: 2 columns × 3 rows)',
    },
    settings: {
      title: 'Data Management & Configuration',
      subtitle: 'Sender details, JSON database backups, restore tools, and demo data',
    },
  };

  const currentMeta = viewTitles[currentView] || {
    title: 'Command Center',
    subtitle: 'Warehouse Operations',
  };

  return (
    <header className="h-16 px-4 md:px-8 border-b border-slate-800/80 bg-[#0f1217]/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger & Context breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Operations</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-slate-200 capitalize font-medium">{currentView}</span>
          </div>
          <h1 className="text-base md:text-lg font-semibold text-white tracking-tight leading-tight">
            {currentMeta.title}
          </h1>
        </div>
      </div>

      {/* Right: Primary interactive controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCustomerModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 transition-colors whitespace-nowrap shadow-xs"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-400" />
          <span>New Customer</span>
        </button>

        <button
          onClick={onOpenTransactionModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Record Entry</span>
        </button>
      </div>
    </header>
  );
};
