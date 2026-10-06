import React, { createContext, useContext } from 'react';
import type { AppLanguage } from '../types';

interface I18nContextType {
  lang: AppLanguage;
  isAr: boolean;
  dir: 'ltr' | 'rtl';
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  tr: (en: string, ar: string) => string;
  translateCategory: (category: string) => string;
  translateOrderStatus: (status: string) => string;
  translatePaymentStatus: (status: string) => string;
  translatePaymentMethod: (method?: string) => string;
  translateHealthLabel: (label: string) => string;
  translateHealthSublabel: (sublabel: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  isAr: false,
  dir: 'ltr',
  setLanguage: () => {},
  toggleLanguage: () => {},
  tr: (en) => en,
  translateCategory: (c) => c,
  translateOrderStatus: (s) => s,
  translatePaymentStatus: (s) => s,
  translatePaymentMethod: (m) => m || '',
  translateHealthLabel: (l) => l,
  translateHealthSublabel: (s) => s,
});

export const useI18n = () => useContext(I18nContext);

export const CATEGORY_AR_MAP: Record<string, string> = {
  'Order Revenue': 'إيرادات الطلبيات',
  'Customer Payment': 'دفعة زبون (تحصيل ذمم)',
  'Owner Capital Injection': 'إضافة نقود من المال الخاص',
  'Personal Withdrawal': 'سحب نقود للاستخدام الشخصي',
  'Other Income': 'إيرادات أخرى',
  'Shipping': 'تكاليف شحن محلي',
  'Local Parcel Shipping': 'شحن طرود محلي',
  'Standard Local Shipping': 'شحن محلي قياسي',
  'Goods/Inventory': 'شراء بضاعة ومخزون',
  'Packaging & Supplies': 'شراء مواد تغليف ولوازم',
  'Vehicle': 'مصاريف المركبات والوقود',
  'Warehouse Rent': 'إيجار المستودع',
  'General': 'مصاريف تشغيلية عامة',
};

export const ORDER_STATUS_AR_MAP: Record<string, string> = {
  'Processing': 'قيد التجهيز',
  'Ready for Dispatch': 'جاهز للشحن',
  'Shipped': 'تم الشحن',
  'Delivered': 'تم التسليم',
  'Cancelled': 'ملغاة',
};

export const PAYMENT_STATUS_AR_MAP: Record<string, string> = {
  'Paid': 'مدفوعة بالكامل',
  'Partially Paid': 'مدفوعة جزئياً',
  'Unpaid': 'غير مدفوعة (على الحساب)',
};

export const PAYMENT_METHOD_AR_MAP: Record<string, string> = {
  'Bank Transfer': 'تحويل بنكي (SEPA)',
  'Cash': 'نقدي (Cash)',
  'Credit Card': 'بطاقة ائتمان',
  'PayPal': 'باي بال (PayPal)',
  'Other': 'طريقة أخرى',
};

export const HEALTH_LABEL_AR_MAP: Record<string, string> = {
  'High Surplus': 'فائض مالي مرتفع',
  'Healthy Profit': 'ربح تشغيلي ممتاز',
  'Positive Balance': 'رصيد إيجابي',
  'Balanced': 'متوازن',
  'Moderate Deficit': 'عجز متوسط',
  'High Debt': 'مديونية مرتفعة',
  'Critical Debt': 'مديونية حرجة',
};

export const HEALTH_SUBLABEL_AR_MAP: Record<string, string> = {
  'Strong capital reserve & net margin': 'احتياطي رأس مال قوي وهامش صافي ممتاز',
  'Solid positive cashflow after payables': 'تدفق نقدي إيجابي قوي بعد خصم المستحقات',
  'Revenues exceed operating & supplier costs': 'الإيرادات تتجاوز تكاليف التشغيل والموردين',
  'Break-even operational position': 'وضع تشغيلي متعادل (نقطة التعادل)',
  'Payables & costs slightly exceed revenue': 'المستحقات والتكاليف تتجاوز الإيرادات قليلاً',
  'Significant supplier debt & cost pressure': 'ديون موردين وضغط تكاليف ملحوظ',
  'Urgent payables & negative net exposure': 'مستحقات عاجلة وصافي مديونية سلبي',
};
