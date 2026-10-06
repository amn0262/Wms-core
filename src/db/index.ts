import Dexie, { type Table } from 'dexie';
import type {
  Customer,
  Transaction,
  SenderSettings,
  Supplier,
  SupplierTransaction,
  CustomerOrder,
} from '../types';

export class WMSDatabase extends Dexie {
  customers!: Table<Customer, number>;
  finances!: Table<Transaction, number>;
  suppliers!: Table<Supplier, number>;
  supplierTransactions!: Table<SupplierTransaction, number>;
  orders!: Table<CustomerOrder, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('WMS_Database_v2');
    this.version(1).stores({
      customers: '++id, firstName, lastName, city, created',
      finances: '++id, type, category, amount, date, customerId, timestamp',
      settings: 'key',
    });
    this.version(2).stores({
      customers: '++id, firstName, lastName, city, created',
      finances: '++id, type, category, amount, date, customerId, timestamp',
      settings: 'key',
      suppliers: '++id, name, created',
      supplierTransactions: '++id, supplierId, type, amount, date, timestamp',
    });
    this.version(3).stores({
      customers: '++id, firstName, lastName, city, created',
      finances: '++id, type, category, amount, date, customerId, timestamp',
      settings: 'key',
      suppliers: '++id, name, created',
      supplierTransactions: '++id, supplierId, type, amount, date, timestamp',
      orders: '++id, orderNumber, customerId, status, orderDate, trackingNumber, timestamp',
    });
  }
}

export const db = new WMSDatabase();

export const DEFAULT_SENDER_SETTINGS: SenderSettings = {
  senderName: 'Bakkour Logistics',
  senderStreet: 'Fabrikstr. 21E',
  senderZip: '07629',
  senderCity: 'Reichenbach',
  senderCountry: 'Germany',
  currencySymbol: '€',
  companyVat: 'DE382910482',
  showCountryField: false,
  enableDynamicTheme: true,
  language: 'ar',
};

export async function getSenderSettings(): Promise<SenderSettings> {
  try {
    const entry = await db.settings.get('sender_settings');
    if (entry && entry.value) {
      return { ...DEFAULT_SENDER_SETTINGS, ...entry.value };
    }
  } catch (err) {
    console.error('Failed to get sender settings:', err);
  }
  return DEFAULT_SENDER_SETTINGS;
}

export async function saveSenderSettings(settings: SenderSettings): Promise<void> {
  await db.settings.put({ key: 'sender_settings', value: settings });
}

export async function seedDemoData(): Promise<void> {
  const existingCustomers = await db.customers.count();
  if (existingCustomers > 0) {
    return; // Don't overwrite if already seeded
  }

  const now = new Date();
  const formatD = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  const sampleCustomers: Omit<Customer, 'id'>[] = [
    {
      firstName: 'Marcus',
      lastName: 'Schmidt',
      company: 'Schmidt Warenhandel GmbH',
      address: 'Hauptstraße 12',
      postalCode: '10115',
      city: 'Berlin',
      country: 'Germany',
      email: 'm.schmidt@waren-berlin.de',
      phone: '+49 30 8920194',
      created: Date.now() - 30 * 86400000,
    },
    {
      firstName: 'Elena',
      lastName: 'Rostova',
      company: 'Nordic Supply Co',
      address: 'Kaufingerstraße 24',
      postalCode: '80331',
      city: 'München',
      country: 'Germany',
      email: 'elena@nordicsupply.de',
      phone: '+49 89 2314567',
      created: Date.now() - 25 * 86400000,
    },
    {
      firstName: 'Lucas',
      lastName: 'Dubois',
      company: 'Atelier Dubois',
      address: '14 Rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'France',
      email: 'contact@lucasdubois.fr',
      phone: '+33 1 42 68 55 00',
      created: Date.now() - 20 * 86400000,
    },
    {
      firstName: 'Sophie',
      lastName: 'Van Der Beek',
      company: 'Dutch Express Fulfillment',
      address: 'Keizersgracht 421',
      postalCode: '1016 EK',
      city: 'Amsterdam',
      country: 'Netherlands',
      email: 'sophie@dutchexpress.nl',
      phone: '+31 20 624 3456',
      created: Date.now() - 15 * 86400000,
    },
    {
      firstName: 'Alexander',
      lastName: 'Weber',
      company: 'Alpen Logistics AG',
      address: 'Bahnhofstrasse 88',
      postalCode: '8001',
      city: 'Zürich',
      country: 'Switzerland',
      email: 'a.weber@alpenlog.ch',
      phone: '+41 44 211 44 22',
      created: Date.now() - 10 * 86400000,
    },
    {
      firstName: 'Clara',
      lastName: 'Müller',
      company: 'Müller E-Commerce',
      address: 'Königsallee 55',
      postalCode: '40212',
      city: 'Düsseldorf',
      country: 'Germany',
      email: 'clara@mueller-shop.de',
      phone: '+49 211 384729',
      created: Date.now() - 5 * 86400000,
    },
  ];

  const cIds: number[] = [];
  for (const c of sampleCustomers) {
    const id = await db.customers.add(c as Customer);
    cIds.push(id);
  }

  const sampleTransactions: Omit<Transaction, 'id'>[] = [
    // Marcus Schmidt
    {
      type: 'Income',
      category: 'Order Revenue',
      description: 'Bulk order #ORD-8401 (Pallet footwear restock)',
      amount: 4850.0,
      date: formatD(24),
      customerId: cIds[0],
      invoiceNumber: 'INV-2026-081',
      timestamp: Date.now() - 24 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Shipping',
      description: 'DHL Freight Pallet dispatch #8401',
      amount: 280.0,
      date: formatD(24),
      customerId: cIds[0],
      invoiceNumber: 'EXP-DHL-1092',
      timestamp: Date.now() - 24 * 86400000 + 1000,
    },
    // Elena Rostova
    {
      type: 'Income',
      category: 'Order Revenue',
      description: 'Standard shipment #ORD-8412 (Apparel batch)',
      amount: 1950.0,
      date: formatD(18),
      customerId: cIds[1],
      invoiceNumber: 'INV-2026-085',
      timestamp: Date.now() - 18 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Shipping',
      description: 'DPD Express 3x Box dispatch',
      amount: 48.5,
      date: formatD(18),
      customerId: cIds[1],
      invoiceNumber: 'EXP-DPD-4481',
      timestamp: Date.now() - 18 * 86400000 + 1000,
    },
    // Lucas Dubois
    {
      type: 'Income',
      category: 'Order Revenue',
      description: 'International parcel order #ORD-8425',
      amount: 3200.0,
      date: formatD(14),
      customerId: cIds[2],
      invoiceNumber: 'INV-2026-092',
      timestamp: Date.now() - 14 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Shipping',
      description: 'UPS Standard Cross-Border to Paris',
      amount: 112.0,
      date: formatD(14),
      customerId: cIds[2],
      invoiceNumber: 'EXP-UPS-9821',
      timestamp: Date.now() - 14 * 86400000 + 1000,
    },
    // Sophie Van Der Beek
    {
      type: 'Income',
      category: 'Order Revenue',
      description: 'Dutch wholesale consignment #ORD-8438',
      amount: 2650.0,
      date: formatD(8),
      customerId: cIds[3],
      invoiceNumber: 'INV-2026-098',
      timestamp: Date.now() - 8 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Shipping',
      description: 'DHL Euroconnect to Amsterdam',
      amount: 95.0,
      date: formatD(8),
      customerId: cIds[3],
      invoiceNumber: 'EXP-DHL-2098',
      timestamp: Date.now() - 8 * 86400000 + 1000,
    },
    // Clara Müller
    {
      type: 'Income',
      category: 'Order Revenue',
      description: 'Expedited consignment #ORD-8449',
      amount: 1420.0,
      date: formatD(2),
      customerId: cIds[5],
      invoiceNumber: 'INV-2026-104',
      timestamp: Date.now() - 2 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Shipping',
      description: 'DHL Next-Day Service to Düsseldorf',
      amount: 32.5,
      date: formatD(2),
      customerId: cIds[5],
      invoiceNumber: 'EXP-DHL-3011',
      timestamp: Date.now() - 2 * 86400000 + 1000,
    },
    // Inventory purchases (Costs of Goods)
    {
      type: 'Expense',
      category: 'Goods/Inventory',
      description: 'Wholesale Supplier A Restock - 200 units Outerwear',
      amount: 3450.0,
      date: formatD(26),
      customerId: null,
      invoiceNumber: 'SUP-4920',
      timestamp: Date.now() - 26 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Goods/Inventory',
      description: 'Wholesale Supplier B Restock - Footwear batch 150 pairs',
      amount: 2100.0,
      date: formatD(16),
      customerId: null,
      invoiceNumber: 'SUP-4991',
      timestamp: Date.now() - 16 * 86400000,
    },
    // Warehouse Operational Costs
    {
      type: 'Expense',
      category: 'Packaging & Supplies',
      description: 'Carton boxes (500x), heavy duty tape & bubble roll pallet',
      amount: 420.0,
      date: formatD(22),
      customerId: null,
      invoiceNumber: 'PKG-1184',
      timestamp: Date.now() - 22 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Vehicle',
      description: 'Warehouse Mercedes Sprinter diesel refueling + toll',
      amount: 145.2,
      date: formatD(12),
      customerId: null,
      invoiceNumber: 'FUEL-842',
      timestamp: Date.now() - 12 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Vehicle',
      description: 'Forklift hydraulic service & safety inspection',
      amount: 280.0,
      date: formatD(6),
      customerId: null,
      invoiceNumber: 'SRV-091',
      timestamp: Date.now() - 6 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Warehouse Rent',
      description: 'Monthly Warehouse Facility Lease (Bay 4)',
      amount: 1250.0,
      date: formatD(1),
      customerId: null,
      invoiceNumber: 'RENT-2026-10',
      timestamp: Date.now() - 1 * 86400000,
    },
    // Owner Personal Capital Injection & Personal Withdrawal
    {
      type: 'Income',
      category: 'Owner Capital Injection',
      description: 'إيداع نقود من المال الخاص لدعم السيولة (Owner Personal Capital Injection)',
      amount: 2500.0,
      date: formatD(20),
      customerId: null,
      invoiceNumber: 'OWN-IN-001',
      paymentMethod: 'Bank Transfer',
      timestamp: Date.now() - 20 * 86400000,
    },
    {
      type: 'Expense',
      category: 'Personal Withdrawal',
      description: 'سحب نقود للاستخدام الشخصي (Owner Personal Cash Draw)',
      amount: 600.0,
      date: formatD(7),
      customerId: null,
      invoiceNumber: 'OWN-OUT-001',
      paymentMethod: 'Cash',
      timestamp: Date.now() - 7 * 86400000,
    },
  ];

  await db.finances.bulkAdd(sampleTransactions as Transaction[]);

  // Seed Sample Customer Orders (Paid, Partially Paid, and Unpaid on Account)
  const sampleOrders: Omit<CustomerOrder, 'id'>[] = [
    {
      orderNumber: 'ORD-2026-8401',
      customerId: cIds[0],
      customerName: 'Marcus Schmidt (Schmidt Warenhandel GmbH)',
      itemsDescription: 'Pallet footwear restock (120 pairs)',
      amount: 4850.0,
      paidAmount: 4850.0,
      paymentStatus: 'Paid',
      orderDate: formatD(24),
      status: 'Delivered',
      carrier: 'DHL',
      trackingNumber: '00340434190823908401',
      shippedDate: formatD(24),
      timestamp: Date.now() - 24 * 86400000,
    },
    {
      orderNumber: 'ORD-2026-8412',
      customerId: cIds[1],
      customerName: 'Elena Rostova (Nordic Supply Co)',
      itemsDescription: 'Apparel batch 3x Master Cartons',
      amount: 1950.0,
      paidAmount: 1950.0,
      paymentStatus: 'Paid',
      orderDate: formatD(18),
      status: 'Delivered',
      carrier: 'DPD',
      trackingNumber: '01505128492011',
      shippedDate: formatD(18),
      timestamp: Date.now() - 18 * 86400000,
    },
    {
      orderNumber: 'ORD-2026-8455',
      customerId: cIds[4],
      customerName: 'Alexander Weber (Alpen Logistics AG)',
      itemsDescription: 'Winter technical jackets consignment (45 units) - On Account',
      amount: 3600.0,
      paidAmount: 0,
      paymentStatus: 'Unpaid',
      orderDate: formatD(5),
      status: 'Shipped',
      carrier: 'DHL',
      trackingNumber: '00340434190823908455',
      shippedDate: formatD(4),
      notes: 'Executed without immediate payment (14-day customer credit terms)',
      timestamp: Date.now() - 5 * 86400000,
    },
    {
      orderNumber: 'ORD-2026-8462',
      customerId: cIds[3],
      customerName: 'Sophie Van Der Beek (Dutch Express Fulfillment)',
      itemsDescription: '2x Euro-Pallets Sportswear Assortment',
      amount: 2400.0,
      paidAmount: 1000.0,
      paymentStatus: 'Partially Paid',
      orderDate: formatD(3),
      status: 'Ready for Dispatch',
      carrier: 'GLS',
      notes: '€1,000 deposit received; €1,400 remaining balance due on account',
      timestamp: Date.now() - 3 * 86400000,
    },
  ];

  await db.orders.bulkAdd(sampleOrders as CustomerOrder[]);
}
