import jsPDF from 'jspdf';
import type { PrintQueueItem, SenderSettings } from '../types';

export function generateA4ShippingLabels(
  items: PrintQueueItem[],
  sender: SenderSettings
): { blob: Blob; filename: string } {
  if (items.length === 0) {
    throw new Error('Queue is empty');
  }

  // DIN A4 standard dimensions: 210mm width x 297mm height
  // 6 labels per page: 2 columns x 3 rows
  // Label size: 105mm width x 99mm height
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const slots = [
    { x: 0, y: 0 },
    { x: 105, y: 0 },
    { x: 0, y: 99 },
    { x: 105, y: 99 },
    { x: 0, y: 198 },
    { x: 105, y: 198 },
  ];

  // Flatten items according to quantity
  const flattened: PrintQueueItem[] = [];
  items.forEach((item) => {
    const qty = Math.max(1, item.quantity || 1);
    for (let k = 0; k < qty; k++) {
      flattened.push(item);
    }
  });

  flattened.forEach((item, index) => {
    const slotIndex = index % 6;

    if (index > 0 && slotIndex === 0) {
      doc.addPage();
    }

    const { x, y } = slots[slotIndex];
    const customer = item.customer;

    // Draw subtle dashed cutting / separation guide border
    doc.setDrawColor(205, 210, 218);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x + 1.5, y + 1.5, 102, 96);
    doc.setLineDashPattern([], 0); // reset dash

    // ==========================================
    // 1. ABSENDER (المرسل فقط باللغة الألمانية وبدون اسم الدولة)
    // ==========================================
    const senderX = x + 7;
    let senderY = y + 9;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 115, 125);
    doc.text('Absender:', senderX, senderY);
    senderY += 5;

    // Sender Name
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 25, 35);
    doc.text(sender.senderName, senderX, senderY);
    senderY += 4.5;

    // Sender Street, Postal Code & City (No Country)
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 75);
    doc.text(`${sender.senderStreet}, ${sender.senderZip} ${sender.senderCity}`, senderX, senderY);

    // Clean hairline divider between Absender and Empfänger
    doc.setDrawColor(215, 220, 228);
    doc.setLineWidth(0.35);
    doc.line(x + 7, y + 25, x + 98, y + 25);

    // ==========================================
    // 2. EMPFÄNGER (المستقبل فقط باللغة الألمانية وبدون اسم الدولة)
    // ==========================================
    const recipientX = x + 10;
    let recipientY = y + 36;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(115, 120, 130);
    doc.text('Empfänger:', recipientX, recipientY);
    recipientY += 7.5;

    // Company Name (if present)
    if (customer.company && customer.company.trim()) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(30, 40, 50);
      doc.text(customer.company.trim(), recipientX, recipientY);
      recipientY += 7;
    }

    // Recipient Full Name (Large & Bold for clear postal reading)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 15, 25);
    doc.text(`${customer.firstName} ${customer.lastName}`, recipientX, recipientY);
    recipientY += 8.5;

    // Street & House Number
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(20, 25, 35);
    doc.text(customer.address, recipientX, recipientY);
    recipientY += 8;

    // Postal Code & City (Large and bold)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(10, 15, 25);
    doc.text(`${customer.postalCode} ${customer.city}`, recipientX, recipientY);
    // Notice: Country is intentionally completely omitted as requested!
  });

  const now = new Date();
  const filename = `Versandetiketten_6er_A4_${now.toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output('blob');

  return { blob, filename };
}
