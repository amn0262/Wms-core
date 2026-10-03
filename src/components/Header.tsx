import React, { useState } from 'react';
import { Menu, Plus, UserPlus, Info } from 'lucide-react';
import type { FinancialHealthMetrics } from '../utils/financialTheme';

interface HeaderProps {
  currentView: string;
  onOpenMobileMenu: () => void;
  onOpenTransactionModal: () => void;
  onOpenCustomerModal: () => void;
  financialHealth?: FinancialHealthMetrics;
  enableDynamicTheme?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenMobileMenu,
  onOpenTransactionModal,
  onOpenCustomerModal,
  financialHealth,
  enableDynamicTheme = true,
}) => {
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);

  const viewTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Operational Overview',
      subtitle: 'Real-time financial performance and warehouse metrics',
    },
    orders: {
      title: 'Customer Orders & Shipments',
      subtitle: 'Consignment fulfillment, carrier tracking numbers, and delivery status',
    },
    customers: {
      title: 'Customer Directory & Profitability',
      subtitle: 'Accounts, lifetime revenue, shipping expenditures, and margin analysis',
    },
    suppliers: {
      title: 'Suppliers & Vendor Accounts',
      subtitle: 'Accounts payable, bill tracking, settlements, and debt/surplus balances',
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
          className="md:hidden p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white cursor-pointer"
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

      {/* Right: Dynamic Financial Health Indicator & Controls */}
      <div className="flex items-center gap-3">
        {/* Dynamic Financial Health Badge */}
        {enableDynamicTheme && financialHealth && (
          <div className="relative">
            <button
              onClick={() => setShowHealthTooltip(!showHealthTooltip)}
              onMouseEnter={() => setShowHealthTooltip(true)}
              onMouseLeave={() => setShowHealthTooltip(false)}
              className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${financialHealth.badgeClass}`}
              title="Click for Financial Position Breakdown"
            >
              <span className={`w-2 h-2 rounded-full ${financialHealth.dotClass}`} />
              <span className="hidden md:inline font-sans">{financialHealth.label}:</span>
              <span>
                {financialHealth.comprehensiveNet >= 0 ? '+' : ''}€
                {financialHealth.comprehensiveNet.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </button>

            {/* Health Breakdown Popover Tooltip */}
            {showHealthTooltip && (
              <div className="absolute right-0 top-full mt-2 w-72 p-3.5 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl z-50 text-xs font-sans text-slate-300 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${financialHealth.dotClass}`} />
                    Financial Health Pulse
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">Live Tier</span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Revenue:</span>
                    <span className="text-emerald-400 font-bold">
                      €{financialHealth.totalIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Expenses:</span>
                    <span className="text-rose-400 font-bold">
                      €{financialHealth.totalExpenses.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Operating Net:</span>
                    <span className={financialHealth.operationalNet >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      €{financialHealth.operationalNet.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Supplier Debt Due:</span>
                    <span className="text-rose-400 font-bold">
                      -€{financialHealth.totalSupplierDebt.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-700 text-xs">
                    <span className="font-bold text-white">Comprehensive Net:</span>
                    <span
                      className={`font-bold ${
                        financialHealth.comprehensiveNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {financialHealth.comprehensiveNet >= 0 ? '+' : ''}€
                      {financialHealth.comprehensiveNet.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 leading-tight">
                  Status: <strong className="text-white">{financialHealth.sublabel}</strong>. Interface colors shift dynamically based on this balance.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onOpenCustomerModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-400" />
          <span>New Customer</span>
        </button>

        <button
          onClick={onOpenTransactionModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Entry</span>
        </button>
      </div>
    </header>
  );
};
