import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/utils";
import { getInvoiceQrDataUrl } from "@/lib/qr";
import { Invoice, BusinessProfile } from "@/lib/types";
import path from "path";
import fs from "fs";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 12,
    marginBottom: 8,
  },
  companyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "60%",
  },
  companyLogo: {
    width: 48,
    height: 48,
    marginRight: 8,
    objectFit: "contain",
  },
  companyDetails: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  companyTagline: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#64748b",
    marginBottom: 4,
  },
  companyText: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.3,
  },
  companyTaxId: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginTop: 2,
  },
  invoiceTitleBlock: {
    width: "40%",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  invoiceTitleBadge: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  invoiceMetaText: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right",
    lineHeight: 1.3,
  },
  invoiceMetaVal: {
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  billingContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 8,
    marginBottom: 10,
  },
  billToLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clientName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    marginBottom: 2,
  },
  clientText: {
    fontSize: 8,
    color: "#475569",
    lineHeight: 1.2,
  },
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    minHeight: 18,
  },
  tableHeaderCol: {
    padding: 3,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#475569",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    alignItems: "center",
    minHeight: 18,
  },
  tableRowCol: {
    padding: 3,
    fontSize: 8,
    color: "#334155",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
  },
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryLeft: {
    width: "55%",
  },
  summaryRight: {
    width: "40%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 6,
  },
  notesLabel: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    color: "#334155",
    lineHeight: 1.3,
    marginBottom: 10,
  },
  bankContainer: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 6,
  },
  bankTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bankRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  bankLabel: {
    width: "40%",
    fontSize: 7,
    color: "#64748b",
  },
  bankVal: {
    width: "60%",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },
  paymentDetailsRow: {
    flexDirection: "row",
    gap: 8,
  },
  qrBlock: {
    alignItems: "center",
    width: 60,
  },
  qrImage: {
    width: 54,
    height: 54,
  },
  qrLabel: {
    fontSize: 5,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginTop: 2,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 8,
  },
  summaryLabel: {
    color: "#64748b",
  },
  summaryVal: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
    textAlign: "right",
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
    paddingTop: 4,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  summaryTotalVal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "right",
  },
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  signBlock: {
    width: "40%",
    alignItems: "flex-end",
  },
  signLabel: {
    fontSize: 7,
    color: "#64748b",
  },
  companySignName: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 4,
    textAlign: "center",
    fontSize: 7,
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

interface InvoiceDocumentProps {
  invoice: any;
  profile: any;
  logoPath?: string | null;
  qrDataUrl?: string | null;
}

const InvoiceDocument = ({ invoice, profile, logoPath, qrDataUrl }: InvoiceDocumentProps) => {
  const currency = invoice.currency || profile.currency;
  const fmt = (amount: number) => formatCurrency(amount, currency);
  const isQuote = invoice.type === "quote";
  const qrImageSrc = profile.qrCodeUrl || qrDataUrl || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.companyHeaderRow}>
            {logoPath && invoice.display.showLogo ? <Image src={logoPath} style={styles.companyLogo} /> : null}
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{profile.name}</Text>
              {profile.tagline ? <Text style={styles.companyTagline}>{profile.tagline}</Text> : null}
              {profile.address ? <Text style={styles.companyText}>{profile.address}</Text> : null}
              <Text style={styles.companyText}>
                {[profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}
              </Text>
              <Text style={styles.companyText}>
                {profile.phone ? `Phone: ${profile.phone}  ` : ""}
                {profile.email ? `Email: ${profile.email}` : ""}
              </Text>
              {profile.taxId ? <Text style={styles.companyTaxId}>Tax ID: {profile.taxId}</Text> : null}
            </View>
          </View>
          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.invoiceTitleBadge}>{isQuote ? "Quote" : "Invoice"}</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.invoiceMetaText}>
                {isQuote ? "Quote No: " : "Invoice No: "}
                <Text style={styles.invoiceMetaVal}>{invoice.invoiceNo}</Text>
              </Text>
              <Text style={styles.invoiceMetaText}>
                Date:{" "}
                <Text style={styles.invoiceMetaVal}>
                  {new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </Text>
              {invoice.dueDate ? (
                <Text style={styles.invoiceMetaText}>
                  {isQuote ? "Valid Until: " : "Due: "}
                  <Text style={styles.invoiceMetaVal}>
                    {new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.billingContainer}>
          <Text style={styles.billToLabel}>Bill To</Text>
          <Text style={styles.clientName}>{invoice.clientSnapshot.name}</Text>
          {invoice.clientSnapshot.companyName ? (
            <Text style={styles.clientText}>{invoice.clientSnapshot.companyName}</Text>
          ) : null}
          {invoice.clientSnapshot.address ? <Text style={styles.clientText}>{invoice.clientSnapshot.address}</Text> : null}
          {invoice.clientSnapshot.taxId ? (
            <Text style={[styles.clientText, { fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 2 }]}>
              Tax ID: {invoice.clientSnapshot.taxId}
            </Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <View style={[styles.tableHeaderCol, { width: "5%", textAlign: "center" }]}>
              <Text>Sl</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "37%" }]}>
              <Text>Description</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "10%", textAlign: "right" }]}>
              <Text>Qty</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "8%", textAlign: "center" }]}>
              <Text>Unit</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "13%", textAlign: "right" }]}>
              <Text>Rate</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "13%", textAlign: "right" }]}>
              <Text>Taxable</Text>
            </View>
            <View style={[styles.tableHeaderCol, { width: "14%", textAlign: "right", borderRightWidth: 0 }]}>
              <Text>Amount</Text>
            </View>
          </View>

          {invoice.lineItems.map((item: any, idx: number) => (
            <View style={styles.tableRow} key={idx}>
              <View style={[styles.tableRowCol, { width: "5%", textAlign: "center" }]}>
                <Text>{item.slNo}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "37%", fontFamily: "Helvetica-Bold", color: "#0f172a" }]}>
                <Text>{item.description}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "10%", textAlign: "right" }]}>
                <Text>{item.quantity}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "8%", textAlign: "center", textTransform: "uppercase", fontSize: 6 }]}>
                <Text>{item.unit}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "13%", textAlign: "right" }]}>
                <Text>{item.rate.toFixed(2)}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "13%", textAlign: "right" }]}>
                <Text>{item.taxableValue.toFixed(2)}</Text>
              </View>
              <View style={[styles.tableRowCol, { width: "14%", textAlign: "right", borderRightWidth: 0, fontFamily: "Helvetica-Bold" }]}>
                <Text>{item.amount.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryContainer} wrap={false}>
          <View style={styles.summaryLeft}>
            {invoice.notes && invoice.display.showNotes ? (
              <>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </>
            ) : null}

            {!isQuote &&
            invoice.display.showPaymentDetails &&
            (invoice.paymentInstructions || profile.bank?.accountNo || profile.upiId || qrImageSrc) ? (
              <View style={styles.paymentDetailsRow}>
                <View style={[styles.bankContainer, { flex: 1 }]}>
                  <Text style={styles.bankTitle}>Payment Details</Text>
                  {invoice.paymentInstructions ? (
                    <Text style={[styles.bankVal, { width: "100%", marginBottom: 4 }]}>{invoice.paymentInstructions}</Text>
                  ) : null}
                  {profile.bank?.bankName ? (
                    <View style={styles.bankRow}>
                      <Text style={styles.bankLabel}>Bank Name:</Text>
                      <Text style={styles.bankVal}>{profile.bank.bankName}</Text>
                    </View>
                  ) : null}
                  {profile.bank?.accountNo ? (
                    <View style={styles.bankRow}>
                      <Text style={styles.bankLabel}>A/C Number:</Text>
                      <Text style={styles.bankVal}>{profile.bank.accountNo}</Text>
                    </View>
                  ) : null}
                  {profile.bank?.ifscOrSwift ? (
                    <View style={styles.bankRow}>
                      <Text style={styles.bankLabel}>IFSC / SWIFT:</Text>
                      <Text style={styles.bankVal}>{profile.bank.ifscOrSwift}</Text>
                    </View>
                  ) : null}
                  {profile.upiId ? (
                    <View style={styles.bankRow}>
                      <Text style={styles.bankLabel}>UPI ID:</Text>
                      <Text style={styles.bankVal}>{profile.upiId}</Text>
                    </View>
                  ) : null}
                </View>
                {qrImageSrc ? (
                  <View style={styles.qrBlock}>
                    <Image src={qrImageSrc} style={styles.qrImage} />
                    <Text style={styles.qrLabel}>Scan to Pay</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.summaryRight}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryVal}>{fmt(invoice.subtotal)}</Text>
            </View>
            {invoice.totalDiscount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Discount:</Text>
                <Text style={[styles.summaryVal, { color: "#b91c1c" }]}>-{fmt(invoice.totalDiscount)}</Text>
              </View>
            )}
            {invoice.display.showTaxBreakdown && (
              <>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 2 }]}>
                  <Text style={[styles.summaryLabel, { fontFamily: "Helvetica-Bold", color: "#334155" }]}>Taxable Value:</Text>
                  <Text style={styles.summaryVal}>{fmt(invoice.taxableValueTotal)}</Text>
                </View>
                {invoice.taxTotal > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax Total:</Text>
                    <Text style={styles.summaryVal}>{fmt(invoice.taxTotal)}</Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Grand Total:</Text>
              <Text style={styles.summaryTotalVal}>{fmt(invoice.grandTotal)}</Text>
            </View>
            {!isQuote && invoice.amountPaid > 0 && (
              <>
                <View style={[styles.summaryRow, { marginTop: 4 }]}>
                  <Text style={[styles.summaryLabel, { color: "#059669" }]}>Amount Paid:</Text>
                  <Text style={[styles.summaryVal, { color: "#059669" }]}>-{fmt(invoice.amountPaid)}</Text>
                </View>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Balance Due:</Text>
                  <Text style={[styles.summaryTotalVal, { color: invoice.balanceDue > 0 ? "#b91c1c" : "#059669" }]}>
                    {fmt(Math.max(invoice.balanceDue, 0))}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.signatureContainer} wrap={false}>
          <View style={styles.signBlock}>
            <Text style={styles.signLabel}>for</Text>
            <Text style={styles.companySignName}>{profile.name}</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}  |  Printed on: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
          }
          fixed
        />
      </Page>
    </Document>
  );
};

/**
 * Renders an invoice/quote to a PDF buffer. Shared by the download API route
 * and the email-sending action so the two never drift out of sync.
 */
export async function generateInvoicePdfBuffer(invoice: Invoice, profile: BusinessProfile): Promise<Buffer> {
  let logoPath: string | null = null;
  if (profile.logoUrl && profile.logoUrl.startsWith("/")) {
    const candidate = path.join(process.cwd(), "public", profile.logoUrl);
    if (fs.existsSync(candidate)) {
      logoPath = candidate;
    }
  }

  let resolvedProfile: BusinessProfile = profile;
  if (profile.qrCodeUrl && profile.qrCodeUrl.startsWith("/")) {
    const candidate = path.join(process.cwd(), "public", profile.qrCodeUrl);
    resolvedProfile = { ...profile, qrCodeUrl: fs.existsSync(candidate) ? candidate : "" };
  }
  const qrDataUrl = profile.qrCodeUrl ? null : await getInvoiceQrDataUrl(profile, invoice);

  const doc = <InvoiceDocument invoice={invoice} profile={resolvedProfile} logoPath={logoPath} qrDataUrl={qrDataUrl} />;
  const buffer = await pdf(doc).toBuffer();
  return buffer as unknown as Buffer;
}

export function invoicePdfFilename(invoice: Invoice): string {
  const kind = invoice.type === "quote" ? "quote" : "invoice";
  return `${kind}_${invoice.invoiceNo.replace(/\//g, "_")}.pdf`;
}
