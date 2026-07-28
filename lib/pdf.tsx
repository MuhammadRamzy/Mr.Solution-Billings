import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet, Image, Link, Font } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/utils";
import { getInvoiceQrDataUrl, getInvoiceUpiUri } from "@/lib/qr";
import { Invoice, BusinessProfile } from "@/lib/types";
import path from "path";
import fs from "fs";

// react-pdf's built-in Helvetica base font has no glyph for the Indian Rupee
// sign (U+20B9) - it silently renders a superscript "1" instead. Roboto does,
// so register it locally (no network fetch at render time in serverless).
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(FONTS_DIR, "Roboto-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS_DIR, "Roboto-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONTS_DIR, "Roboto-Italic.ttf"), fontStyle: "italic" },
  ],
});

const INDIGO = "#4338ca";
const INDIGO_TINT = "#eef2ff";
const INK = "#0f172a";
const SLATE = "#475569";
const MUTED = "#94a3b8";
const LINE = "#e2e8f0";
const HAIRLINE = "#f1f5f9";
const GREEN = "#059669";
const RED = "#dc2626";

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 9,
    fontFamily: "Roboto",
    color: SLATE,
    backgroundColor: "#ffffff",
  },
  accentBar: {
    height: 6,
    backgroundColor: INDIGO,
  },
  content: {
    padding: 36,
    paddingBottom: 60,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoImage: {
    width: 28,
    height: 28,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 15,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },
  businessTagline: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontStyle: "italic",
    color: MUTED,
    marginTop: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  docBadge: {
    backgroundColor: INDIGO_TINT,
    color: INDIGO,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "Roboto",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  docNo: {
    fontSize: 11,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
    marginTop: 8,
  },
  metaLine: {
    fontSize: 8,
    color: SLATE,
    marginTop: 3,
    textAlign: "right",
  },
  metaVal: {
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },

  // Business + Bill To info strip
  infoStrip: {
    flexDirection: "row",
    marginBottom: 20,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoName: {
    fontSize: 10,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 8,
    color: SLATE,
    lineHeight: 1.45,
  },
  infoTaxId: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
    marginTop: 3,
  },

  // Table
  table: {
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: INDIGO_TINT,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily: "Roboto",
    fontWeight: "bold",
    fontSize: 7.5,
    color: INDIGO,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  td: {
    fontSize: 8.5,
    color: SLATE,
  },
  tdStrong: {
    fontSize: 8.5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },
  itemUrl: {
    fontSize: 7,
    color: INDIGO,
    marginTop: 2,
    textDecoration: "underline",
  },

  // Summary section
  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  summaryLeft: {
    width: "52%",
    paddingRight: 16,
  },
  summaryRight: {
    width: "44%",
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: SLATE,
    lineHeight: 1.5,
    marginBottom: 14,
  },
  paymentCard: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 7.5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INDIGO,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  paymentInstructions: {
    fontSize: 8,
    color: SLATE,
    lineHeight: 1.4,
    marginBottom: 6,
  },
  paymentRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  paymentLabel: {
    width: "38%",
    fontSize: 7.5,
    color: MUTED,
  },
  paymentVal: {
    width: "62%",
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },
  qrBlock: {
    alignItems: "center",
    justifyContent: "flex-start",
    width: 66,
    marginLeft: 10,
  },
  qrImage: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    padding: 2,
  },
  qrLabel: {
    fontSize: 6,
    color: MUTED,
    fontFamily: "Roboto",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginTop: 3,
    textAlign: "center",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 8.5,
  },
  summaryLabel: {
    color: SLATE,
  },
  summaryVal: {
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
    textAlign: "right",
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
    marginTop: 2,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: INDIGO,
    paddingTop: 8,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },
  grandTotalVal: {
    fontSize: 15,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INDIGO,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 9,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
  },
  balanceVal: {
    fontSize: 12,
    fontFamily: "Roboto",
    fontWeight: "bold",
  },

  // Footer / signature
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 26,
  },
  signBlock: {
    width: "42%",
    alignItems: "flex-end",
  },
  signLabel: {
    fontSize: 7.5,
    color: MUTED,
  },
  companySignName: {
    fontSize: 8.5,
    fontFamily: "Roboto",
    fontWeight: "bold",
    color: INK,
    marginTop: 1,
  },
  signLine: {
    fontSize: 7.5,
    color: SLATE,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 3,
    marginTop: 22,
    width: 130,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
    textAlign: "center",
    fontSize: 6.5,
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});

const COLS = {
  sl: "6%",
  desc: "36%",
  qty: "9%",
  unit: "8%",
  rate: "13%",
  taxable: "13%",
  amount: "15%",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface InvoiceDocumentProps {
  invoice: any;
  profile: any;
  logoPath?: string | null;
  qrDataUrl?: string | null;
  upiUri?: string | null;
}

const InvoiceDocument = ({ invoice, profile, logoPath, qrDataUrl, upiUri }: InvoiceDocumentProps) => {
  const currency = invoice.currency || profile.currency;
  const fmt = (amount: number) => formatCurrency(amount, currency);
  const isQuote = invoice.type === "quote";
  const qrImageSrc = profile.qrCodeUrl || qrDataUrl || null;
  const showLogo = logoPath && invoice.display.showLogo;

  const hasPaymentDetails =
    !isQuote &&
    invoice.display.showPaymentDetails &&
    (invoice.paymentInstructions || profile.bank?.accountNo || profile.upiId || qrImageSrc);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} fixed />
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              {showLogo ? (
                <View style={styles.logoBox}>
                  <Image src={logoPath!} style={styles.logoImage} />
                </View>
              ) : null}
              <View>
                <Text style={styles.businessName}>{profile.name}</Text>
                {profile.tagline ? <Text style={styles.businessTagline}>{profile.tagline}</Text> : null}
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.docBadge}>{isQuote ? "Quote" : "Invoice"}</Text>
              <Text style={styles.docNo}>{invoice.invoiceNo}</Text>
              <Text style={styles.metaLine}>
                Date: <Text style={styles.metaVal}>{fmtDate(invoice.invoiceDate)}</Text>
              </Text>
              {invoice.dueDate ? (
                <Text style={styles.metaLine}>
                  {isQuote ? "Valid Until: " : "Due: "}
                  <Text style={styles.metaVal}>{fmtDate(invoice.dueDate)}</Text>
                </Text>
              ) : null}
            </View>
          </View>

          {/* From / Bill To */}
          <View style={styles.infoStrip}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>From</Text>
              <Text style={styles.infoName}>{profile.name}</Text>
              {profile.address ? <Text style={styles.infoText}>{profile.address}</Text> : null}
              <Text style={styles.infoText}>{[profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}</Text>
              <Text style={styles.infoText}>
                {profile.phone ? `${profile.phone}` : ""}
                {profile.phone && profile.email ? "  •  " : ""}
                {profile.email || ""}
              </Text>
              {profile.taxId ? <Text style={styles.infoTaxId}>Tax ID: {profile.taxId}</Text> : null}
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Bill To</Text>
              <Text style={styles.infoName}>{invoice.clientSnapshot.name}</Text>
              {invoice.clientSnapshot.companyName ? <Text style={styles.infoText}>{invoice.clientSnapshot.companyName}</Text> : null}
              {invoice.clientSnapshot.address ? <Text style={styles.infoText}>{invoice.clientSnapshot.address}</Text> : null}
              {invoice.clientSnapshot.email ? <Text style={styles.infoText}>{invoice.clientSnapshot.email}</Text> : null}
              {invoice.clientSnapshot.taxId ? <Text style={styles.infoTaxId}>Tax ID: {invoice.clientSnapshot.taxId}</Text> : null}
            </View>
          </View>

          {/* Line items table */}
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, { width: COLS.sl, textAlign: "center" }]}>Sl</Text>
              <Text style={[styles.th, { width: COLS.desc }]}>Description</Text>
              <Text style={[styles.th, { width: COLS.qty, textAlign: "right" }]}>Qty</Text>
              <Text style={[styles.th, { width: COLS.unit, textAlign: "center" }]}>Unit</Text>
              <Text style={[styles.th, { width: COLS.rate, textAlign: "right" }]}>Rate</Text>
              <Text style={[styles.th, { width: COLS.taxable, textAlign: "right" }]}>Taxable</Text>
              <Text style={[styles.th, { width: COLS.amount, textAlign: "right" }]}>Amount</Text>
            </View>

            {invoice.lineItems.map((item: any, idx: number) => (
              <View style={styles.tableRow} key={idx} wrap={false}>
                <Text style={[styles.td, { width: COLS.sl, textAlign: "center" }]}>{item.slNo}</Text>
                <View style={{ width: COLS.desc }}>
                  <Text style={styles.tdStrong}>{item.description}</Text>
                  {item.url ? (
                    <Link src={item.url} style={styles.itemUrl}>
                      {item.url}
                    </Link>
                  ) : null}
                </View>
                <Text style={[styles.td, { width: COLS.qty, textAlign: "right" }]}>{item.quantity}</Text>
                <Text style={[styles.td, { width: COLS.unit, textAlign: "center", textTransform: "uppercase", fontSize: 7 }]}>
                  {item.unit}
                </Text>
                <Text style={[styles.td, { width: COLS.rate, textAlign: "right" }]}>{item.rate.toFixed(2)}</Text>
                <Text style={[styles.td, { width: COLS.taxable, textAlign: "right" }]}>{item.taxableValue.toFixed(2)}</Text>
                <Text style={[styles.tdStrong, { width: COLS.amount, textAlign: "right" }]}>{item.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Notes + Payment + Totals */}
          <View style={styles.summaryContainer} wrap={false}>
            <View style={styles.summaryLeft}>
              {invoice.notes && invoice.display.showNotes ? (
                <>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notesText}>{invoice.notes}</Text>
                </>
              ) : null}

              {hasPaymentDetails ? (
                <View style={styles.paymentCard}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentTitle}>Payment Details</Text>
                    {invoice.paymentInstructions ? <Text style={styles.paymentInstructions}>{invoice.paymentInstructions}</Text> : null}
                    {profile.bank?.bankName ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Bank:</Text>
                        <Text style={styles.paymentVal}>{profile.bank.bankName}</Text>
                      </View>
                    ) : null}
                    {profile.bank?.accountName ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Account Holder:</Text>
                        <Text style={styles.paymentVal}>{profile.bank.accountName}</Text>
                      </View>
                    ) : null}
                    {profile.bank?.accountNo ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Account No:</Text>
                        <Text style={styles.paymentVal}>{profile.bank.accountNo}</Text>
                      </View>
                    ) : null}
                    {profile.bank?.ifscOrSwift ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>IFSC:</Text>
                        <Text style={styles.paymentVal}>{profile.bank.ifscOrSwift}</Text>
                      </View>
                    ) : null}
                    {profile.bank?.branch ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Branch:</Text>
                        <Text style={styles.paymentVal}>{profile.bank.branch}</Text>
                      </View>
                    ) : null}
                    {profile.upiId ? (
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>UPI ID:</Text>
                        {upiUri ? (
                          <Link src={upiUri} style={[styles.paymentVal, { color: INDIGO, textDecoration: "underline" }]}>
                            {profile.upiId}
                          </Link>
                        ) : (
                          <Text style={styles.paymentVal}>{profile.upiId}</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                  {qrImageSrc ? (
                    <View style={styles.qrBlock}>
                      {upiUri ? (
                        <Link src={upiUri}>
                          <Image src={qrImageSrc} style={styles.qrImage} />
                        </Link>
                      ) : (
                        <Image src={qrImageSrc} style={styles.qrImage} />
                      )}
                      <Text style={styles.qrLabel}>Tap or Scan to Pay</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.summaryRight}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryVal}>{fmt(invoice.subtotal)}</Text>
              </View>
              {invoice.totalDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryVal, { color: RED }]}>-{fmt(invoice.totalDiscount)}</Text>
                </View>
              )}
              {invoice.display.showTaxBreakdown && (
                <View style={styles.summaryDivider}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontFamily: "Roboto",
    fontWeight: "bold", color: INK }]}>Taxable Value</Text>
                    <Text style={styles.summaryVal}>{fmt(invoice.taxableValueTotal)}</Text>
                  </View>
                  {invoice.taxTotal > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tax</Text>
                      <Text style={styles.summaryVal}>{fmt(invoice.taxTotal)}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalVal}>{fmt(invoice.grandTotal)}</Text>
              </View>

              {!isQuote && invoice.amountPaid > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: GREEN }]}>Amount Paid</Text>
                    <Text style={[styles.summaryVal, { color: GREEN }]}>-{fmt(invoice.amountPaid)}</Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Balance Due</Text>
                    <Text style={[styles.balanceVal, { color: invoice.balanceDue > 0 ? RED : GREEN }]}>
                      {fmt(Math.max(invoice.balanceDue, 0))}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Signature */}
          <View style={styles.signatureContainer} wrap={false}>
            <View style={styles.signBlock}>
              <Text style={styles.signLabel}>For</Text>
              <Text style={styles.companySignName}>{profile.name}</Text>
              <Text style={styles.signLine}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}  •  This is a computer generated ${isQuote ? "quote" : "invoice"}  •  ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`
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
  const upiUri = getInvoiceUpiUri(profile, invoice);

  const doc = <InvoiceDocument invoice={invoice} profile={resolvedProfile} logoPath={logoPath} qrDataUrl={qrDataUrl} upiUri={upiUri} />;
  const buffer = await pdf(doc).toBuffer();
  return buffer as unknown as Buffer;
}

export function invoicePdfFilename(invoice: Invoice): string {
  const kind = invoice.type === "quote" ? "quote" : "invoice";
  return `${kind}_${invoice.invoiceNo.replace(/\//g, "_")}.pdf`;
}
