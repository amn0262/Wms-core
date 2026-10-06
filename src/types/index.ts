export type TransactionType = 'Income' | 'Expense';

export type TransactionCategory =
  | 'Order Revenue'
  | 'Customer Payment'
  | 'Owner Capital Injection'
  | 'Other Income'
  | 'Shipping'
  | 'Goods/Inventory'
  | 'Vehicle'
  | 'Warehouse Rent'
  | 'Packaging & Supplies'
  | 'Personal Withdrawal'
  | 'General';

export interface Customer {
  id?: number;
  firstName: string;
  lastName: string;
  company?: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  notes?: string;
  created: number;
}

export interface Transaction {
  id?: number;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  customerId?: number | null;
  orderId?: number | null;
  invoiceNumber?: string;
  paymentMethod?: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
  timestamp: number;
}

export interface PrintQueueItem {
  id: string; // unique queue uuid
  customer: Customer;
  quantity: number;
  packageType?: string;
  referenceNote?: string;
}

export interface SenderSettings {
  senderName: string;
  senderStreet: string;
  senderZip: string;
  senderCity: string;
  senderCountry: string;
  currencySymbol: string;
  companyVat?: string;
  showCountryField?: boolean; // When false, hide the country field across customer forms and address views
  enableDynamicTheme?: boolean; // When true, shift app accent colors based on overall profit/debt health
}

// ==========================================
// SUPPLIERS (GOODS & MERCHANDISE VENDORS)
// ==========================================
export interface Supplier {
  id?: number;
  name: string; // Goods / Merchandise Supplier Name (NO physical address required)
  contactPerson?: string; // Representative / Account manager
  phone?: string;
  email?: string;
  notes?: string;
  created: number;
}

export type SupplierTransactionType = 'Bill' | 'Payment';
// 'Bill' = Vendor invoiced us for purchases (Increases debt / payable)
// 'Payment' = We paid or settled with vendor (Decreases debt / creates surplus)

export interface SupplierTransaction {
  id?: number;
  supplierId: number;
  type: SupplierTransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  referenceInvoice?: string; // Invoice number, tracking ID, or receipt code
  paymentMethod?: 'Bank Transfer' | 'Cash' | 'Credit Card' | 'PayPal' | 'Other';
  timestamp: number;
}

// ==========================================
// CUSTOMER ORDERS, PAYMENT STATUS & TRACKING
// ==========================================
export type OrderStatus = 'Processing' | 'Ready for Dispatch' | 'Shipped' | 'Delivered' | 'Cancelled';

export type OrderPaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid';

export type CarrierType = 'DHL' | 'DPD' | 'Hermes' | 'GLS' | 'UPS' | 'Other';

export interface CustomerOrder {
  id?: number;
  orderNumber: string; // e.g. "ORD-2026-1049"
  customerId: number;
  customerName?: string;
  itemsDescription: string;
  amount: number; // Total Order value in €
  paidAmount?: number; // Amount paid so far in € (0 if unpaid on credit)
  paymentStatus?: OrderPaymentStatus; // 'Paid' | 'Partially Paid' | 'Unpaid'
  orderDate: string; // YYYY-MM-DD
  status: OrderStatus;
  carrier?: CarrierType;
  trackingNumber?: string;
  shippedDate?: string; // YYYY-MM-DD
  notes?: string;
  financeTransactionId?: number; // Linked initial revenue transaction in finances (if paid on creation)
  timestamp: number;
}
