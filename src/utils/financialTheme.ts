import type { Transaction, Supplier, SupplierTransaction } from '../types';

export interface FinancialHealthMetrics {
  // 1. All Revenues Breakdown
  ordersRevenue: number; // Customer orders income
  otherRevenue: number; // Other miscellaneous receipts
  totalIncome: number; // All income combined

  // 2. All Expenses & Direct Outflows Breakdown
  shippingExpenses: number; // Freight & carrier costs (DHL, etc.)
  goodsExpensesDirect: number; // Direct goods/merchandise cash outlays
  fleetExpenses: number; // Vehicle & fuel expenses
  warehouseRentExpenses: number; // Facility & storage lease
  packagingExpenses: number; // Boxes, tape & shipping supplies
  generalExpenses: number; // Administrative & operating overhead
  totalExpenses: number; // All ledger expenses combined

  // 3. Supplier Merchandise Accounts Breakdown
  supplierBillsTotal: number; // Total billed by goods suppliers
  supplierPaymentsTotal: number; // Total paid to goods suppliers
  totalSupplierDebt: number; // Unpaid accounts payable owed to suppliers
  totalSupplierCredit: number; // Advance credits held with suppliers
  netSupplierExposure: number; // Debt minus credit

  // 4. Comprehensive Consolidated Position
  operationalNet: number; // totalIncome - totalExpenses
  comprehensiveNet: number; // operationalNet - totalSupplierDebt (All-inclusive real position)
  isProfitable: boolean;
  isInDebt: boolean;

  // 5. Dynamic Graded Theme State
  tierId: 'strong-profit' | 'solid-profit' | 'mild-profit' | 'break-even' | 'mild-debt' | 'moderate-debt' | 'heavy-debt';
  tierLevel: number; // +3, +2, +1, 0, -1, -2, -3
  label: string;
  sublabel: string;
  accentHex: string;
  badgeClass: string;
  glowClass: string;
  ambientGradient: string;
  sidebarActive: string;
  dotClass: string;
  cardBorder: string;
  textTone: string;
}

export function computeFinancialHealth(
  transactions: Transaction[],
  suppliers: Supplier[],
  supplierTransactions: SupplierTransaction[]
): FinancialHealthMetrics {
  // 1. Operational Finances (Revenues, Carrier Shipping, Direct Goods, Overheads)
  let ordersRevenue = 0;
  let otherRevenue = 0;
  let totalIncome = 0;

  let shippingExpenses = 0;
  let goodsExpensesDirect = 0;
  let fleetExpenses = 0;
  let warehouseRentExpenses = 0;
  let packagingExpenses = 0;
  let generalExpenses = 0;
  let totalExpenses = 0;

  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Income') {
      totalIncome += amt;
      if (t.category === 'Order Revenue') ordersRevenue += amt;
      else otherRevenue += amt;
    } else {
      totalExpenses += amt;
      if (t.category === 'Shipping') shippingExpenses += amt;
      else if (t.category === 'Goods/Inventory') goodsExpensesDirect += amt;
      else if (t.category === 'Vehicle') fleetExpenses += amt;
      else if (t.category === 'Warehouse Rent') warehouseRentExpenses += amt;
      else if (t.category === 'Packaging & Supplies') packagingExpenses += amt;
      else generalExpenses += amt;
    }
  });

  const operationalNet = totalIncome - totalExpenses;

  // 2. Merchandise Supplier Accounts (Bills for Goods vs Payments Sent)
  const supplierBalances: Record<number, number> = {};
  suppliers.forEach((s) => {
    if (s.id) supplierBalances[s.id] = 0;
  });

  let supplierBillsTotal = 0;
  let supplierPaymentsTotal = 0;

  supplierTransactions.forEach((st) => {
    const amt = Number(st.amount) || 0;
    if (st.type === 'Bill') {
      supplierBillsTotal += amt;
      if (st.supplierId && supplierBalances[st.supplierId] !== undefined) {
        supplierBalances[st.supplierId] += amt;
      }
    } else {
      supplierPaymentsTotal += amt;
      if (st.supplierId && supplierBalances[st.supplierId] !== undefined) {
        supplierBalances[st.supplierId] -= amt;
      }
    }
  });

  let totalSupplierDebt = 0;
  let totalSupplierCredit = 0;

  Object.values(supplierBalances).forEach((bal) => {
    if (bal > 0.01) {
      totalSupplierDebt += bal;
    } else if (bal < -0.01) {
      totalSupplierCredit += Math.abs(bal);
    }
  });

  const netSupplierExposure = totalSupplierDebt - totalSupplierCredit;

  // 3. Complete Consolidated Real Net:
  // All Customer Revenues MINUS All Operating Costs (Shipping, Rent, Fleet, Packaging, General)
  // MINUS Direct Goods purchases MINUS Outstanding Supplier Goods Debts!
  const comprehensiveNet = operationalNet - totalSupplierDebt;

  const isProfitable = comprehensiveNet > 0;
  const isInDebt = comprehensiveNet < 0;

  const baseMetrics = {
    ordersRevenue,
    otherRevenue,
    totalIncome,
    shippingExpenses,
    goodsExpensesDirect,
    fleetExpenses,
    warehouseRentExpenses,
    packagingExpenses,
    generalExpenses,
    totalExpenses,
    supplierBillsTotal,
    supplierPaymentsTotal,
    totalSupplierDebt,
    totalSupplierCredit,
    netSupplierExposure,
    operationalNet,
    comprehensiveNet,
    isProfitable,
    isInDebt,
  };

  // 4. Graded Financial Health Tiers (Real Consolidated Mood)
  if (comprehensiveNet >= 15000) {
    return {
      ...baseMetrics,
      tierId: 'strong-profit',
      tierLevel: 3,
      label: 'Strong Profit Tier 3',
      sublabel: 'High Solvency & Capital Reserve',
      accentHex: '#10b981',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs',
      glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
      ambientGradient: 'from-emerald-500 via-teal-400 to-emerald-600',
      sidebarActive: 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500',
      dotClass: 'bg-emerald-400 animate-pulse',
      cardBorder: 'border-emerald-500/30',
      textTone: 'text-emerald-400',
    };
  }

  if (comprehensiveNet >= 3000) {
    return {
      ...baseMetrics,
      tierId: 'solid-profit',
      tierLevel: 2,
      label: 'Solid Profit Tier 2',
      sublabel: 'Healthy Cashflow & Net Surplus',
      accentHex: '#059669',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
      glowClass: 'shadow-[0_0_15px_rgba(5,150,105,0.2)]',
      ambientGradient: 'from-emerald-600 via-emerald-500 to-teal-500',
      sidebarActive: 'bg-emerald-600/15 text-emerald-400 border-l-2 border-emerald-500',
      dotClass: 'bg-emerald-400',
      cardBorder: 'border-emerald-500/20',
      textTone: 'text-emerald-400',
    };
  }

  if (comprehensiveNet > 100) {
    return {
      ...baseMetrics,
      tierId: 'mild-profit',
      tierLevel: 1,
      label: 'Mild Profit Tier 1',
      sublabel: 'Positive Operational Margin',
      accentHex: '#0d9488',
      badgeClass: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
      glowClass: 'shadow-[0_0_10px_rgba(13,148,136,0.15)]',
      ambientGradient: 'from-teal-600 via-teal-500 to-emerald-500',
      sidebarActive: 'bg-teal-600/15 text-teal-300 border-l-2 border-teal-500',
      dotClass: 'bg-teal-400',
      cardBorder: 'border-teal-500/20',
      textTone: 'text-teal-400',
    };
  }

  if (comprehensiveNet >= -100) {
    return {
      ...baseMetrics,
      tierId: 'break-even',
      tierLevel: 0,
      label: 'Break-Even Tier 0',
      sublabel: 'Balanced Position (€0.00 Net)',
      accentHex: '#0284c7',
      badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
      glowClass: '',
      ambientGradient: 'from-sky-600 via-slate-600 to-sky-400',
      sidebarActive: 'bg-sky-600/15 text-sky-400 border-l-2 border-sky-500',
      dotClass: 'bg-sky-400',
      cardBorder: 'border-slate-800',
      textTone: 'text-sky-400',
    };
  }

  if (comprehensiveNet >= -3000) {
    return {
      ...baseMetrics,
      tierId: 'mild-debt',
      tierLevel: -1,
      label: 'Mild Deficit Tier -1',
      sublabel: 'Low Margin / Short-term Debt',
      accentHex: '#d97706',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      glowClass: 'shadow-[0_0_12px_rgba(217,119,6,0.2)]',
      ambientGradient: 'from-amber-600 via-orange-500 to-amber-500',
      sidebarActive: 'bg-amber-600/15 text-amber-300 border-l-2 border-amber-500',
      dotClass: 'bg-amber-400 animate-pulse',
      cardBorder: 'border-amber-500/30',
      textTone: 'text-amber-400',
    };
  }

  if (comprehensiveNet >= -15000) {
    return {
      ...baseMetrics,
      tierId: 'moderate-debt',
      tierLevel: -2,
      label: 'Moderate Debt Tier -2',
      sublabel: 'Operating Deficit / Payables Due',
      accentHex: '#ea580c',
      badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
      glowClass: 'shadow-[0_0_18px_rgba(234,88,12,0.25)]',
      ambientGradient: 'from-orange-600 via-red-500 to-amber-600',
      sidebarActive: 'bg-orange-600/20 text-orange-300 border-l-2 border-orange-500',
      dotClass: 'bg-orange-500 animate-pulse',
      cardBorder: 'border-orange-500/35',
      textTone: 'text-orange-400',
    };
  }

  // Critical Debt / Heavy Loss
  return {
    ...baseMetrics,
    tierId: 'heavy-debt',
    tierLevel: -3,
    label: 'Critical Debt Tier -3',
    sublabel: 'High Solvency Alert / Heavy Payables',
    accentHex: '#e11d48',
    badgeClass: 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-xs',
    glowClass: 'shadow-[0_0_22px_rgba(225,29,72,0.35)]',
    ambientGradient: 'from-rose-600 via-red-600 to-rose-500',
    sidebarActive: 'bg-rose-600/25 text-rose-300 border-l-2 border-rose-500',
    dotClass: 'bg-rose-500 animate-ping',
    cardBorder: 'border-rose-500/40',
    textTone: 'text-rose-400',
  };
}
