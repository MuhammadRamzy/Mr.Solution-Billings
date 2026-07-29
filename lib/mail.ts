import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { Invoice, BusinessProfile, Client } from "./types";
import { formatCurrency, formatDate } from "./utils";
import { getInvoiceQrDataUrl, getInvoiceUpiUri } from "./qr";

const ACCENT = "#4338ca";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function resolveLocalAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) {
    const candidate = path.join(process.cwd(), "public", url);
    return fs.existsSync(candidate) ? candidate : null;
  }
  return url;
}

function payButtonHtml(upiUri: string | null) {
  if (!upiUri) return "";
  return `
    <div style="margin-top:14px;text-align:center;">
      <a href="${upiUri}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:11px 26px;border-radius:8px;">
        Pay via UPI
      </a>
    </div>`;
}

export function buildEmailHtml(opts: {
  invoice: Invoice;
  profile: BusinessProfile;
  hasQrCid: boolean;
  hasLogoCid: boolean;
  upiUri: string | null;
  variant: "invoice" | "reminder";
}) {
  const { invoice, profile, hasQrCid, hasLogoCid, upiUri, variant } = opts;
  const isQuote = invoice.type === "quote";
  const currency = invoice.currency || profile.currency;
  const fmt = (n: number) => formatCurrency(n, currency);

  // Two columns, not four - a rigid Description/Qty/Rate/Amount grid forces
  // the description into an unreadably narrow wrap on a phone-width inbox.
  // Qty/rate move into a small meta line under the description instead.
  const rowsHtml = invoice.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <div style="font-size:13px;color:#0f172a;font-weight:600;">${item.description}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${item.quantity} ${item.unit} &times; ${fmt(item.rate)}${item.discountPercent > 0 ? ` &bull; -${item.discountPercent}%` : ""}</div>
          ${item.url ? `<a href="${item.url}" style="font-size:11px;font-weight:500;color:${ACCENT};text-decoration:none;">${item.url}</a>` : ""}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;vertical-align:top;white-space:nowrap;">${fmt(item.amount)}</td>
      </tr>`
    )
    .join("");

  const paymentBlock =
    !isQuote &&
    invoice.display.showPaymentDetails &&
    (invoice.paymentInstructions || profile.bank?.accountNo || profile.upiId || hasQrCid)
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr>
          <td style="padding:16px;">
            <div style="font-size:11px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Payment Details</div>
            ${invoice.paymentInstructions ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;white-space:pre-line;">${invoice.paymentInstructions}</p>` : ""}
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              ${profile.bank?.bankName ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">Bank</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${profile.bank.bankName}</td></tr>` : ""}
              ${profile.bank?.accountName ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">Account Holder</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${profile.bank.accountName}</td></tr>` : ""}
              ${profile.bank?.accountNo ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">Account No.</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${profile.bank.accountNo}</td></tr>` : ""}
              ${profile.bank?.ifscOrSwift ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">IFSC</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${profile.bank.ifscOrSwift}</td></tr>` : ""}
              ${profile.bank?.branch ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">Branch</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${profile.bank.branch}</td></tr>` : ""}
              ${profile.upiId ? `<tr><td style="padding:2px 0;font-size:12px;color:#64748b;">UPI ID</td><td style="padding:2px 0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;font-family:monospace;">${profile.upiId}</td></tr>` : ""}
            </table>
            ${hasQrCid ? `<div style="margin-top:12px;text-align:center;"><img src="cid:paymentqr" alt="Scan to pay" width="130" height="130" style="border:1px solid #e2e8f0;border-radius:8px;" /><div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-top:4px;">Tap or Scan to Pay</div></div>` : ""}
            ${payButtonHtml(upiUri)}
          </td>
        </tr>
      </table>`
      : "";

  const balanceBlock =
    !isQuote && invoice.amountPaid > 0
      ? `
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#059669;">Amount Paid</td>
        <td style="padding:6px 12px;font-size:12px;color:#059669;text-align:right;font-weight:700;">-${fmt(invoice.amountPaid)}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#0f172a;font-weight:800;border-top:1px solid #e2e8f0;">Balance Due</td>
        <td style="padding:6px 12px;font-size:14px;color:${invoice.balanceDue > 0 ? "#dc2626" : "#059669"};text-align:right;font-weight:800;border-top:1px solid #e2e8f0;">${fmt(Math.max(invoice.balanceDue, 0))}</td>
      </tr>`
      : "";

  const isReminder = variant === "reminder";
  const dueText = invoice.dueDate
    ? new Date(invoice.dueDate).getTime() < Date.now()
      ? `was due on <strong style="color:#dc2626;">${formatDate(invoice.dueDate)}</strong>`
      : `due on <strong>${formatDate(invoice.dueDate)}</strong>`
    : "";

  const greeting = isReminder
    ? `<p style="margin:0 0 4px;font-size:14px;color:#334155;">Hi ${invoice.clientSnapshot.name},</p>
       <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
         This is a friendly reminder that invoice <strong>${invoice.invoiceNo}</strong> has a balance of
         <strong style="color:#dc2626;">${fmt(Math.max(invoice.balanceDue, 0))}</strong> outstanding${dueText ? `, ${dueText}` : ""}.
         You can find the original invoice attached, or pay directly using the details below.
       </p>`
    : `<p style="margin:0 0 4px;font-size:14px;color:#334155;">Hi ${invoice.clientSnapshot.name},</p>
       <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
         ${isQuote
           ? `Please find the quote <strong>${invoice.invoiceNo}</strong> for your review below${invoice.dueDate ? `, valid until <strong>${formatDate(invoice.dueDate)}</strong>` : ""}. Reply to this email to accept or discuss any changes.`
           : `Please find the invoice <strong>${invoice.invoiceNo}</strong> for the work below${invoice.dueDate ? `, due on <strong>${formatDate(invoice.dueDate)}</strong>` : ""}. A copy is attached as a PDF.`}
       </p>`;

  const badgeText = isReminder ? `Payment Reminder ${invoice.invoiceNo}` : `${isQuote ? "Quote" : "Invoice"} ${invoice.invoiceNo}`;

  return `
  <div style="background:#f1f5f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#0f172a;padding:26px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${hasLogoCid ? `<td style="padding-right:14px;vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;"><tr><td style="padding:8px;"><img src="cid:businesslogo" alt="${profile.name}" width="40" height="40" style="display:block;object-fit:contain;" /></td></tr></table></td>` : ""}
            <td style="vertical-align:middle;">
              <span style="color:#ffffff;font-size:21px;font-weight:800;letter-spacing:-0.01em;">${profile.name}</span>
            </td>
          </tr></table>
          <div style="margin-top:12px;">
            <span style="display:inline-block;background:${isReminder ? "#dc2626" : ACCENT};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:5px 12px;border-radius:999px;">
              ${badgeText}
            </span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          ${greeting}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th align="left" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
                <th align="right" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr>
              <td style="padding:6px 12px;font-size:12px;color:#64748b;">Subtotal</td>
              <td style="padding:6px 12px;font-size:12px;color:#334155;text-align:right;">${fmt(invoice.subtotal)}</td>
            </tr>
            ${invoice.totalDiscount > 0 ? `<tr><td style="padding:6px 12px;font-size:12px;color:#64748b;">Discount</td><td style="padding:6px 12px;font-size:12px;color:#dc2626;text-align:right;">-${fmt(invoice.totalDiscount)}</td></tr>` : ""}
            ${invoice.display.showTaxBreakdown && invoice.taxTotal > 0 ? `<tr><td style="padding:6px 12px;font-size:12px;color:#64748b;">Tax</td><td style="padding:6px 12px;font-size:12px;color:#334155;text-align:right;">${fmt(invoice.taxTotal)}</td></tr>` : ""}
            <tr>
              <td style="padding:8px 12px;font-size:15px;color:#0f172a;font-weight:800;border-top:2px solid #0f172a;">Grand Total</td>
              <td style="padding:8px 12px;font-size:18px;color:${ACCENT};font-weight:800;text-align:right;border-top:2px solid #0f172a;">${fmt(invoice.grandTotal)}</td>
            </tr>
            ${balanceBlock}
          </table>

          ${paymentBlock}

          ${invoice.notes && invoice.display.showNotes ? `<p style="margin:20px 0 0;font-size:12px;color:#64748b;white-space:pre-line;line-height:1.6;">${invoice.notes}</p>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Sent via ${profile.name}${profile.email ? ` &bull; ${profile.email}` : ""}</p>
        </td>
      </tr>
    </table>
  </div>`;
}

function buildQrAttachment(profile: BusinessProfile, qrDataUrl: string | null) {
  const localQr = resolveLocalAsset(profile.qrCodeUrl);
  if (localQr) return { filename: "qr.png", path: localQr, cid: "paymentqr" };
  if (qrDataUrl) return { filename: "qr.png", path: qrDataUrl, cid: "paymentqr" };
  return null;
}

function buildLogoAttachment(profile: BusinessProfile) {
  const localLogo = resolveLocalAsset(profile.logoUrl);
  if (!localLogo) return null;
  return { filename: "logo.png", path: localLogo, cid: "businesslogo" };
}

interface SendInvoiceEmailParams {
  invoice: Invoice;
  profile: BusinessProfile;
  client: Client;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export async function sendInvoiceEmail({ invoice, profile, client, pdfBuffer, pdfFilename }: SendInvoiceEmailParams) {
  if (!client.email) {
    return { success: false, error: "This client doesn't have an email address on file." };
  }

  const transport = getTransport();
  if (!transport) {
    return { success: false, error: "Email isn't configured yet - set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env.local." };
  }

  const qrDataUrl = profile.qrCodeUrl ? null : await getInvoiceQrDataUrl(profile, invoice);
  const qrAttachment = buildQrAttachment(profile, qrDataUrl);
  const logoAttachment = invoice.display.showLogo ? buildLogoAttachment(profile) : null;
  const upiUri = getInvoiceUpiUri(profile, invoice);

  const html = buildEmailHtml({
    invoice,
    profile,
    hasQrCid: !!qrAttachment,
    hasLogoCid: !!logoAttachment,
    upiUri,
    variant: "invoice",
  });
  const isQuote = invoice.type === "quote";
  const fromName = process.env.SMTP_FROM_NAME || profile.name;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to: client.email,
      subject: `${isQuote ? "Quote" : "Invoice"} ${invoice.invoiceNo} from ${profile.name}`,
      html,
      text: `${isQuote ? "Quote" : "Invoice"} ${invoice.invoiceNo} - Grand Total: ${formatCurrency(invoice.grandTotal, invoice.currency || profile.currency)}. See attached PDF for details.`,
      attachments: [
        { filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" },
        ...(qrAttachment ? [qrAttachment] : []),
        ...(logoAttachment ? [logoAttachment] : []),
      ],
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invoice email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

interface SendPaymentReminderParams {
  invoice: Invoice;
  profile: BusinessProfile;
  client: Client;
}

/**
 * Sends a lightweight payment-reminder email (no PDF attachment) for an
 * invoice with an outstanding balance. Reuses the same visual language as
 * the invoice email but with reminder-specific copy and a red badge.
 */
export async function sendPaymentReminderEmail({ invoice, profile, client }: SendPaymentReminderParams) {
  if (!client.email) {
    return { success: false, error: "This client doesn't have an email address on file." };
  }
  if (invoice.type !== "invoice") {
    return { success: false, error: "Reminders can only be sent for invoices, not quotes." };
  }
  if (invoice.balanceDue <= 0) {
    return { success: false, error: "This invoice has no outstanding balance." };
  }

  const transport = getTransport();
  if (!transport) {
    return { success: false, error: "Email isn't configured yet - set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env.local." };
  }

  const qrDataUrl = profile.qrCodeUrl ? null : await getInvoiceQrDataUrl(profile, invoice);
  const qrAttachment = buildQrAttachment(profile, qrDataUrl);
  const logoAttachment = invoice.display.showLogo ? buildLogoAttachment(profile) : null;
  const upiUri = getInvoiceUpiUri(profile, invoice);

  const html = buildEmailHtml({
    invoice,
    profile,
    hasQrCid: !!qrAttachment,
    hasLogoCid: !!logoAttachment,
    upiUri,
    variant: "reminder",
  });
  const fromName = process.env.SMTP_FROM_NAME || profile.name;
  const currency = invoice.currency || profile.currency;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to: client.email,
      subject: `Payment Reminder: Invoice ${invoice.invoiceNo} - ${formatCurrency(Math.max(invoice.balanceDue, 0), currency)} due`,
      html,
      text: `Payment reminder - Invoice ${invoice.invoiceNo}. Balance due: ${formatCurrency(Math.max(invoice.balanceDue, 0), currency)}.`,
      attachments: [...(qrAttachment ? [qrAttachment] : []), ...(logoAttachment ? [logoAttachment] : [])],
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send payment reminder email:", error);
    return { success: false, error: error.message || "Failed to send reminder email" };
  }
}
