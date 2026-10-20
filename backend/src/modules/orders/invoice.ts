import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { schema } from '../../db';
import type { StoreSettings } from '../settings/settings.service';

type Order = typeof schema.orders.$inferSelect & { items: (typeof schema.orderItems.$inferSelect)[] };

// pdfkit's built-in fonts don't include the ₹ glyph, so amounts use "Rs."
const money = (p: number) => `Rs. ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Streams a GST tax invoice PDF for an order. */
export function streamInvoice(res: Response, o: Order, s: StoreSettings, customer: { name: string; email?: string | null }) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="invoice-${o.orderNumber}.pdf"`);
  doc.pipe(res);

  const ink = '#111827';
  const muted = '#6b7280';
  const W = doc.page.width - 96;

  // Header
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(22).text(s.storeName, 48, 48);
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(s.address, 48, 76).text(`${s.supportEmail} · ${s.supportPhone}`);
  if (s.gstin) doc.text(`GSTIN: ${s.gstin}`);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(ink).text('TAX INVOICE', 48, 48, { width: W, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(muted)
    .text(`Invoice #: INV-${o.orderNumber}`, 48, 70, { width: W, align: 'right' })
    .text(`Order #: ${o.orderNumber}`, { width: W, align: 'right' })
    .text(`Date: ${new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, { width: W, align: 'right' })
    .text(`Payment: ${o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'} — ${o.paymentStatus}`, { width: W, align: 'right' });

  doc.moveTo(48, 128).lineTo(48 + W, 128).strokeColor('#e5e7eb').stroke();

  // Addresses
  const a = o.shippingAddress;
  doc.fillColor(muted).fontSize(8).text('BILL / SHIP TO', 48, 142);
  doc
    .fillColor(ink)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(a.fullName, 48, 156)
    .font('Helvetica')
    .fontSize(9)
    .text([a.line1, a.line2, a.landmark].filter(Boolean).join(', '))
    .text(`${a.city}, ${a.state} - ${a.pincode}`)
    .text(`Phone: ${a.phone}`);
  if (customer.email) doc.text(customer.email);

  // Items table
  let y = 240;
  const cols = [
    { label: 'Item', x: 48, w: 220 },
    { label: 'HSN/SKU', x: 270, w: 70 },
    { label: 'Qty', x: 342, w: 30, align: 'right' as const },
    { label: 'Rate', x: 374, w: 70, align: 'right' as const },
    { label: 'GST', x: 446, w: 30, align: 'right' as const },
    { label: 'Amount', x: 478, w: W + 48 - 478, align: 'right' as const },
  ];
  doc.rect(48, y - 6, W, 22).fill('#f3f4f6');
  doc.fillColor(muted).font('Helvetica-Bold').fontSize(8);
  cols.forEach((c) => doc.text(c.label.toUpperCase(), c.x + 4, y, { width: c.w - 8, align: c.align }));
  y += 24;
  doc.font('Helvetica').fontSize(9).fillColor(ink);
  for (const i of o.items) {
    const name = i.variantTitle && i.variantTitle !== 'Default' ? `${i.name} (${i.variantTitle})` : i.name;
    const h = Math.max(doc.heightOfString(name, { width: cols[0].w - 8 }), 12);
    doc.text(name, cols[0].x + 4, y, { width: cols[0].w - 8 });
    doc.text(i.sku, cols[1].x + 4, y, { width: cols[1].w - 8 });
    doc.text(String(i.quantity), cols[2].x + 4, y, { width: cols[2].w - 8, align: 'right' });
    doc.text(money(i.price), cols[3].x + 4, y, { width: cols[3].w - 8, align: 'right' });
    doc.text(`${i.taxRate}%`, cols[4].x + 4, y, { width: cols[4].w - 8, align: 'right' });
    doc.text(money(i.total), cols[5].x + 4, y, { width: cols[5].w - 8, align: 'right' });
    y += h + 10;
    doc.moveTo(48, y - 5).lineTo(48 + W, y - 5).strokeColor('#f3f4f6').stroke();
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
  }

  // Totals
  y += 10;
  const row = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(bold ? ink : muted);
    doc.text(label, 330, y, { width: 140 });
    doc.fillColor(ink).text(value, 470, y, { width: W + 48 - 470, align: 'right' });
    y += bold ? 20 : 16;
  };
  row('Subtotal', money(o.subtotal));
  if (o.discount) row(`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `- ${money(o.discount)}`);
  if (o.loyaltyDiscount) row(`Loyalty points (${o.loyaltyPointsUsed})`, `- ${money(o.loyaltyDiscount)}`);
  row('Shipping', o.shippingFee ? money(o.shippingFee) : 'FREE');
  if (o.codFee) row('COD charges', money(o.codFee));
  doc.moveTo(330, y).lineTo(48 + W, y).strokeColor('#e5e7eb').stroke();
  y += 8;
  row('Grand Total', money(o.total), true);
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Includes GST of ${money(o.tax)} (CGST ${money(Math.floor(o.tax / 2))} + SGST ${money(Math.ceil(o.tax / 2))})`, 330, y, { width: W + 48 - 330, align: 'right' });

  // Footer
  doc
    .fontSize(8)
    .fillColor(muted)
    .text('This is a computer-generated invoice and does not require a signature.', 48, 770, { width: W, align: 'center' })
    .text(`Thank you for shopping with ${s.storeName}!`, { width: W, align: 'center' });

  doc.end();
}
