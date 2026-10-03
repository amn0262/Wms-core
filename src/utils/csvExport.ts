import type { Transaction, Customer } from '../types';

export function exportTransactionsToCSV(
  transactions: Transaction[],
  customerMap: Record<number, Customer>,
  filename = 'Warehouse_Transactions.csv'
) {
  const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount (€)', 'Customer', 'City/Country', 'Invoice Ref'];

  const rows = transactions.map((t) => {
    const cust = t.customerId ? customerMap[t.customerId] : null;
    const custName = cust ? `${cust.firstName} ${cust.lastName}` : '';
    const custLoc = cust ? `${cust.city}, ${cust.country}` : '';

    return [
      t.id ?? '',
      t.date,
      t.type,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${custName.replace(/"/g, '""')}"`,
      `"${custLoc.replace(/"/g, '""')}"`,
      `"${(t.invoiceNumber || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
