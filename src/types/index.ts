export type TransactionType = 'Income' | 'Expense';

export type TransactionCategory =
  | 'Order Revenue'
  | 'Other Income'
  | 'Shipping'
  | 'Goods/Inventory'
  | 'Vehicle'
  | 'Warehouse Rent'
  | 'Packaging & Supplies'
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
  invoiceNumber?: string;
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
// CUSTOMER ORDERS & SHIPMENT TRACKING
// ==========================================
export type OrderStatus = 'Processing' | 'Ready for Dispatch' | 'Shipped' | 'Delivered' | 'Cancelled';

export type CarrierType = 'DHL' | 'DPD' | 'UPS' | 'GLS' | 'Hermes' | 'Spedition' | 'Other';

export interface CustomerOrder {
  id?: number;
  orderNumber: string; // e.g. "ORD-2026-1049"
  customerId: number;
  customerName?: string;
  itemsDescription: string;
  amount: number; // Order value in €
  orderDate: string; // YYYY-MM-DD
  status: OrderStatus;
  carrier?: CarrierType;
  trackingNumber?: string;
  shippedDate?: string; // YYYY-MM-DD
  notes?: string;
  financeTransactionId?: number; // Linked revenue transaction in finances
  timestamp: number;
}
