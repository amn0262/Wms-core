import React, { useState } from 'react';
import { Menu, Plus, UserPlus, Globe } from 'lucide-react';
import type { FinancialHealthMetrics } from '../utils/financialTheme';
import { useI18n } from '../utils/i18n';

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
  const {
    tr,
    lang,
    isAr,
    toggleLanguage,
    translateHealthLabel,
    translateHealthSublabel,
  } = useI18n();

  const viewTitles: Record<string, { title: string; subtitle: string; navName: string }> = {
    dashboard: {
      title: tr('Operational Overview', 'نظرة عامة على العمليات'),
      subtitle: tr(
        'Real-time financial performance and warehouse metrics',
        'الأداء المالي المباشر ومؤشرات المستودع والطلبيات'
      ),
      navName: tr('Dashboard', 'لوحة التحكم'),
    },
    orders: {
      title: tr('Customer Orders & Shipments', 'طلبيات الزبائن والشحنات'),
      subtitle: tr(
        'Consignment fulfillment, carrier tracking numbers, and delivery status',
        'تنفيذ الطلبيات، الدفع الفوري أو الآجل، وأرقام تتبع شركات الشحن'
      ),
      navName: tr('Orders', 'الطلبيات'),
    },
    customers: {
      title: tr('Customer Directory & Profitability', 'دليل الزبائن وكشوف الحسابات'),
      subtitle: tr(
        'Accounts, lifetime revenue, shipping expenditures, and margin analysis',
        'حسابات الزبائن، الطلبيات، الدفعات المسددة، والذمم المتبقية'
      ),
      navName: tr('Customers', 'الزبائن'),
    },
    suppliers: {
      title: tr('Suppliers & Vendor Accounts', 'حسابات الموردين وفواتير البضاعة'),
      subtitle: tr(
        'Accounts payable, bill tracking, settlements, and debt/surplus balances',
        'الذمم الدائنة للموردين، فواتير شراء البضاعة، الدفعات المسددة، والأرصدة'
      ),
      navName: tr('Suppliers', 'الموردون'),
    },
    finances: {
      title: tr('Operations & Financial Ledger', 'سجل العمليات الشامل والمحاسبة'),
      subtitle: tr(
        'Income receipts, inventory restocks, shipping, owner funds, and facility expenses',
        'جميع عمليات الطلبيات، الموردين، التغليف، الشحن، المال الخاص، والسحوبات الشخصية'
      ),
      navName: tr('Operations Ledger', 'سجل العمليات'),
    },
    reports: {
      title: tr('Reports & Analytics', 'التقارير والتحليلات المالية'),
      subtitle: tr(
        'Multi-variable filtering, date intervals, and financial statements',
        'فلترة متقدمة متعددة المتغيرات، الفترات الزمنية، وتصدير الكشوفات'
      ),
      navName: tr('Reports', 'التقارير'),
    },
    printQueue: {
      title: tr('A4 Multi-Label Print Queue', 'طابور طباعة ملصقات الشحن A4'),
      subtitle: tr(
        'Batch generation of DIN A4 shipping sheets (6 labels per page: 2 columns × 3 rows)',
        'توليد أوراق ملصقات شحن DIN A4 (6 ملصقات في الصفحة: عمودان × 3 صفوف)'
      ),
      navName: tr('Print Queue', 'طابور الطباعة'),
    },
    settings: {
      title: tr('Data Management & Configuration', 'إدارة البيانات والإعدادات'),
      subtitle: tr(
        'Sender details, language, JSON database backups, restore tools, and demo data',
        'بيانات المرسل، لغة التطبيق، النسخ الاحتياطي، واستعادة قاعدة البيانات'
      ),
      navName: tr('Settings', 'الإعدادات'),
    },
  };

  const currentMeta = viewTitles[currentView] || {
    title: tr('Command Center', 'مركز القيادة'),
    subtitle: tr('Warehouse Operations', 'عمليات المستودع'),
    navName: currentView,
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
            <span>{tr('Operations', 'العمليات')}</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span className="text-slate-200 font-medium">{currentMeta.navName}</span>
          </div>
          <h1 className="text-base md:text-lg font-semibold text-white tracking-tight leading-tight">
            {currentMeta.title}
          </h1>
        </div>
      </div>

      {/* Right: Language Switcher, Dynamic Financial Health Indicator & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Instant Language Switcher Button (EN <-> العربية) */}
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700/80 transition-all shadow-xs cursor-pointer"
          title={tr('Switch to Arabic (تبديل إلى اللغة العربية)', 'Switch to English (التبديل إلى الإنجليزية)')}
        >
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Dynamic Financial Health Badge */}
        {enableDynamicTheme && financialHealth && (
          <div className="relative">
            <button
              onClick={() => setShowHealthTooltip(!showHealthTooltip)}
              onMouseEnter={() => setShowHealthTooltip(true)}
              onMouseLeave={() => setShowHealthTooltip(false)}
              className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${financialHealth.badgeClass}`}
              title={tr('Click for Financial Position Breakdown', 'انقر لعرض تفاصيل المركز المالي')}
            >
              <span className={`w-2 h-2 rounded-full ${financialHealth.dotClass}`} />
              <span className="hidden md:inline font-sans">
                {translateHealthLabel(financialHealth.label)}:
              </span>
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
              <div
                className={`absolute ${
                  isAr ? 'left-0' : 'right-0'
                } top-full mt-2 w-76 p-3.5 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl z-50 text-xs font-sans text-slate-300 space-y-2 animate-in fade-in`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${financialHealth.dotClass}`} />
                    {tr('Financial Health Pulse', 'مؤشر الملاءة والنبض المالي')}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {tr('Live Tier', 'مباشر')}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">
                      {tr('Total Revenue & Inflows:', 'إجمالي الإيرادات والمقبوضات:')}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      €{financialHealth.totalIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">
                      {tr('Total Expenses & Draws:', 'إجمالي المصاريف والمسحوبات:')}
                    </span>
                    <span className="text-rose-400 font-bold">
                      €{financialHealth.totalExpenses.toFixed(2)}
                    </span>
                  </div>
                  {(financialHealth.ownerCapitalInjected > 0 ||
                    financialHealth.personalWithdrawals > 0) && (
                    <div className="flex justify-between text-[10px] pt-1 border-t border-slate-800/60">
                      <span className="text-teal-400 font-sans">
                        {tr('Owner Funds (+In / -Draw):', 'المال الخاص (+إيداع / -سحب):')}
                      </span>
                      <span className="text-slate-200 font-bold">
                        +€{financialHealth.ownerCapitalInjected.toFixed(0)} / -€
                        {financialHealth.personalWithdrawals.toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">
                      {tr('Cash / Operating Net:', 'صافي السيولة التشغيلية:')}
                    </span>
                    <span
                      className={
                        financialHealth.operationalNet >= 0
                          ? 'text-emerald-400 font-bold'
                          : 'text-rose-400 font-bold'
                      }
                    >
                      €{financialHealth.operationalNet.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-400 font-sans">
                      {tr('Supplier Debt Due:', 'ديون الموردين المستحقة:')}
                    </span>
                    <span className="text-rose-400 font-bold">
                      -€{financialHealth.totalSupplierDebt.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-700 text-xs">
                    <span className="font-bold text-white font-sans">
                      {tr('Comprehensive Net:', 'الصافي الشامل:')}
                    </span>
                    <span
                      className={`font-bold ${
                        financialHealth.comprehensiveNet >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {financialHealth.comprehensiveNet >= 0 ? '+' : ''}€
                      {financialHealth.comprehensiveNet.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 leading-tight">
                  {tr('Status:', 'الحالة:')}{' '}
                  <strong className="text-white">
                    {translateHealthSublabel(financialHealth.sublabel)}
                  </strong>
                  .{' '}
                  {tr(
                    'Interface colors shift dynamically based on this balance.',
                    'تتغير ألوان الواجهة تلقائياً حسب هذا الرصيد.'
                  )}
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
          <span>{tr('New Customer', 'زبون جديد')}</span>
        </button>

        <button
          onClick={onOpenTransactionModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{tr('Record Entry', 'تسجيل قيد')}</span>
        </button>
      </div>
    </header>
  );
};
