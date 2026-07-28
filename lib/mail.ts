import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { Invoice, BusinessProfile, Client } from "./types";
import { formatCurrency, formatDate } from "./utils";
import { getInvoiceQrDataUrl } from "./qr";

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

function buildInvoiceEmailHtml(invoice: Invoice, profile: BusinessProfile, hasQrCid: boolean) {
  const isQuote = invoice.type === "quote";
  const currency = invoice.currency || profile.currency;
  const fmt = (n: number) => formatCurrency(n, currency);
  const accent = "#4338ca";

  const rowsHtml = invoice.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:600;">${item.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:right;">${item.quantity} ${item.unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:right;">${fmt(item.rate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${fmt(item.amount)}</td>
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
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Payment Details</div>
            ${invoice.paymentInstructions ? `<p style="margin:0 0 8px;font-size:13px;color:#334155;white-space:pre-line;">${invoice.paymentInstructions}</p>` : ""}
            ${profile.bank?.bankName ? `<div style="font-size:12px;color:#475569;">Bank: <strong style="color:#0f172a;">${profile.bank.bankName}</strong></div>` : ""}
            ${profile.bank?.accountNo ? `<div style="font-size:12px;color:#475569;">A/C: <strong style="color:#0f172a;font-family:monospace;">${profile.bank.accountNo}</strong></div>` : ""}
            ${profile.bank?.ifscOrSwift ? `<div style="font-size:12px;color:#475569;">IFSC/SWIFT: <strong style="color:#0f172a;font-family:monospace;">${profile.bank.ifscOrSwift}</strong></div>` : ""}
            ${profile.upiId ? `<div style="font-size:12px;color:#475569;">UPI ID: <strong style="color:#0f172a;font-family:monospace;">${profile.upiId}</strong></div>` : ""}
            ${hasQrCid ? `<div style="margin-top:10px;"><img src="cid:paymentqr" alt="Scan to pay" width="120" height="120" style="border:1px solid #e2e8f0;border-radius:8px;" /></div>` : ""}
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

  return `
  <div style="background:#f1f5f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#0f172a;padding:24px 28px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;">${profile.name}</span>
          </div>
          <div style="margin-top:4px;">
            <span style="display:inline-block;background:${accent};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:4px 10px;border-radius:999px;">
              ${isQuote ? "Quote" : "Invoice"} ${invoice.invoiceNo}
            </span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 4px;font-size:14px;color:#334155;">Hi ${invoice.clientSnapshot.name},</p>
          <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
            ${isQuote
              ? `Please find the quote <strong>${invoice.invoiceNo}</strong> for your review below${invoice.dueDate ? `, valid until <strong>${formatDate(invoice.dueDate)}</strong>` : ""}. Reply to this email to accept or discuss any changes.`
              : `Please find the invoice <strong>${invoice.invoiceNo}</strong> for the work below${invoice.dueDate ? `, due on <strong>${formatDate(invoice.dueDate)}</strong>` : ""}. A copy is attached as a PDF.`}
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th align="left" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
                <th align="right" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
                <th align="right" style="padding:10px 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Rate</th>
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
              <td style="padding:8px 12px;font-size:18px;color:${accent};font-weight:800;text-align:right;border-top:2px solid #0f172a;">${fmt(invoice.grandTotal)}</td>
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

  const qrDataUrl = await getInvoiceQrDataUrl(profile, invoice);
  const qrCidAttachment =
    profile.qrCodeUrl && profile.qrCodeUrl.startsWith("/") && fs.existsSync(path.join(process.cwd(), "public", profile.qrCodeUrl))
      ? { filename: "qr.png", path: path.join(process.cwd(), "public", profile.qrCodeUrl), cid: "paymentqr" }
      : profile.qrCodeUrl && !profile.qrCodeUrl.startsWith("/")
      ? { filename: "qr.png", path: profile.qrCodeUrl, cid: "paymentqr" }
      : qrDataUrl
      ? { filename: "qr.png", path: qrDataUrl, cid: "paymentqr" }
      : null;

  const html = buildInvoiceEmailHtml(invoice, profile, !!qrCidAttachment);
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
        ...(qrCidAttachment ? [qrCidAttachment] : []),
      ],
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invoice email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}
