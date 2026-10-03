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
}
