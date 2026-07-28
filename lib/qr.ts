import QRCode from "qrcode";
import { BusinessProfile, Invoice } from "./types";

function buildUpiUri(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

/**
 * Returns a payment QR code as a data: URL for an invoice, or null if there's
 * nothing to show (no UPI ID configured, non-INR currency, or nothing owed).
 * A manually-uploaded `qrCodeUrl` always takes priority over the generated UPI QR.
 */
export async function getInvoiceQrDataUrl(profile: BusinessProfile, invoice: Invoice): Promise<string | null> {
  if (profile.qrCodeUrl) return null;
  if (!profile.upiId) return null;
  if ((invoice.currency || profile.currency) !== "INR") return null;
  if (invoice.type !== "invoice") return null;
  if (invoice.balanceDue <= 0) return null;

  try {
    const uri = buildUpiUri(profile.upiId, profile.name, invoice.balanceDue, invoice.invoiceNo);
    return await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  } catch (e) {
    return null;
  }
}
