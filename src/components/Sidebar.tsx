import React from 'react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  BarChart3,
  Printer,
  Settings,
  Database,
  X,
  Boxes,
  Truck,
  Package,
  Globe,
} from 'lucide-react';
import type { FinancialHealthMetrics } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  printQueueCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  activeCustomerCount: number;
  supplierDebtCount?: number;
  pendingOrdersCount?: number;
  financialHealth?: FinancialHealthMetrics;
  enableDynamicTheme?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  printQueueCount,
  mobileOpen,
  onCloseMobile,
  activeCustomerCount,
  supplierDebtCount = 0,
  pendingOrdersCount = 0,
  financialHealth,
  enableDynamicTheme = true,
}) => {
  const { tr, isAr, lang, setLanguage, translateHealthLabel, translateHealthSublabel } = useI18n();

  const navItems = [
    {
      id: 'dashboard',
      label: tr('Dashboard', 'لوحة التحكم الرئيسية'),
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'orders',
      label: tr('Customer Orders', 'طلبيات الزبائن والشحن'),
      icon: Package,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} ${tr('Due', 'بانتظار')}` : null,
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      id: 'customers',
      label: tr('Customers', 'حسابات الزبائن'),
      icon: Users,
      badge: activeCustomerCount > 0 ? String(activeCustomerCount) : null,
    },
    {
      id: 'suppliers',
      label: tr('Suppliers Ledger', 'سجل الموردين والبضاعة'),
      icon: Truck,
      badge: supplierDebtCount > 0 ? `${supplierDebtCount} ${tr('Due', 'مستحق')}` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'finances',
      label: tr('Operations & Ledger', 'سجل العمليات والمحاسبة'),
      icon: Receipt,
      badge: null,
    },
    {
      id: 'reports',
      label: tr('Reports & Analytics', 'التقارير والتحليلات'),
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'printQueue',
      label: tr('Print Queue', 'طابور طباعة الملصقات'),
      icon: Printer,
      badge: printQueueCount > 0 ? String(printQueueCount) : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'settings',
      label: tr('Data & Settings', 'البيانات والإعدادات'),
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:relative top-0 bottom-0 ${
          isAr ? 'right-0 border-l' : 'left-0 border-r'
        } z-50 w-64 bg-[#0f1217] border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen
            ? 'translate-x-0'
            : isAr
            ? 'translate-x-full md:translate-x-0'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Zone */}
        <div className="p-5 border-b border-slate-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                W<span className="text-rose-500">M</span>S
                <span className="text-xs font-medium text-slate-400">
                  {tr('Core', 'النظام')}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 tracking-wider">
                {tr('Command Center', 'مركز إدارة المستودع')}
              </div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {tr('Operations', 'أقسام النظام')}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const activeClass =
              enableDynamicTheme && financialHealth
                ? financialHealth.sidebarActive
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-xs';
            const iconActiveClass =
              enableDynamicTheme && financialHealth
                ? financialHealth.textTone
                : 'text-rose-500';

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? activeClass
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? iconActiveClass : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                      item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom system footer with Language Switcher & Live Financial Pulse */}
        <div className="p-3 border-t border-slate-800/70 space-y-2">
          {/* Quick Language Toggle in Sidebar */}
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 px-2 text-slate-400 text-[11px] font-medium">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{tr('Language', 'اللغة')}:</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage('ar')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  lang === 'ar'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                العربية
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {enableDynamicTheme && financialHealth && (
            <div
              className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${financialHealth.badgeClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold font-sans text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${financialHealth.dotClass}`} />
                  {translateHealthLabel(financialHealth.label)}
                </span>
                <span className="font-bold">
                  {financialHealth.comprehensiveNet >= 0 ? '+' : ''}€
                  {financialHealth.comprehensiveNet.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5 truncate">
                {translateHealthSublabel(financialHealth.sublabel)}
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">
                  {tr('IndexedDB Core', 'قاعدة بيانات محلية')}
                </span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                {tr('ONLINE', 'متصل')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {tr(
                'Offline-ready storage & instant querying',
                'تخزين فوري يعمل بدون إنترنت'
              )}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
