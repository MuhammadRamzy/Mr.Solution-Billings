import { LineItem, Payment } from "./types";

/**
 * Rounds a number to 2 decimal places.
 */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

interface CalculateLineItemInput {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  taxPercent: number;
}

/**
 * Calculates a single line item's taxable value, tax, and total.
 */
export function calculateLineItem(item: CalculateLineItemInput, slNo: number): LineItem {
  const quantity = item.quantity || 0;
  const rate = item.rate || 0;
  const discountPercent = item.discountPercent || 0;
  const taxPercent = item.taxPercent || 0;

  const rawTaxable = quantity * rate * (1 - discountPercent / 100);
  const taxableValue = roundToTwoDecimals(rawTaxable);
  const taxAmount = roundToTwoDecimals(taxableValue * (taxPercent / 100));
  const amount = roundToTwoDecimals(taxableValue + taxAmount);

  return {
    slNo,
    description: item.description,
    quantity,
    unit: item.unit,
    rate,
    discountPercent,
    taxPercent,
    taxableValue,
    taxAmount,
    amount,
  };
}

interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  taxableValueTotal: number;
  taxTotal: number;
  grandTotal: number;
}

/**
 * Calculates totals for a set of invoice line items.
 */
export function calculateInvoiceTotals(lineItems: LineItem[]): InvoiceTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableValueTotal = 0;
  let taxTotal = 0;

  for (const item of lineItems) {
    const qty = item.quantity || 0;
    const rate = item.rate || 0;
    const discPercent = item.discountPercent || 0;

    subtotal += qty * rate;
    totalDiscount += qty * rate * (discPercent / 100);
    taxableValueTotal += item.taxableValue;
    taxTotal += item.taxAmount;
  }

  subtotal = roundToTwoDecimals(subtotal);
  totalDiscount = roundToTwoDecimals(totalDiscount);
  taxableValueTotal = roundToTwoDecimals(taxableValueTotal);
  taxTotal = roundToTwoDecimals(taxTotal);
  const grandTotal = roundToTwoDecimals(taxableValueTotal + taxTotal);

  return {
    subtotal,
    totalDiscount,
    taxableValueTotal,
    taxTotal,
    grandTotal,
  };
}

interface PaymentStatus {
  amountPaid: number;
  balanceDue: number;
  status: "paid" | "partial" | "sent" | "overdue";
}

/**
 * Derives amountPaid/balanceDue from a payments list, and infers the resulting
 * invoice status. `dueDate` (if passed and in the past with a remaining balance)
 * flips an unpaid/partially-paid invoice to "overdue".
 */
export function derivePaymentStatus(
  grandTotal: number,
  payments: Payment[],
  dueDate?: string | null
): PaymentStatus {
  const amountPaid = roundToTwoDecimals(payments.reduce((acc, p) => acc + p.amount, 0));
  const balanceDue = roundToTwoDecimals(grandTotal - amountPaid);

  let status: PaymentStatus["status"];
  if (balanceDue <= 0) {
    status = "paid";
  } else if (amountPaid > 0) {
    status = "partial";
  } else if (dueDate && new Date(dueDate).getTime() < Date.now()) {
    status = "overdue";
  } else {
    status = "sent";
  }

  return { amountPaid, balanceDue, status };
}
