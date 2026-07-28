"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Printer,
  Download,
  CheckCircle,
  Clock,
  ArrowLeft,
  X,
  Wallet,
  Plus,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ArrowRightCircle,
  AlertCircle,
  QrCode,
  Mail,
  Loader2,
} from "lucide-react";
import { Invoice, BusinessProfile, Client, Payment } from "@/lib/types";
import {
  updateInvoiceStatusAction,
  convertQuoteToInvoiceAction,
  recordPaymentAction,
  deletePaymentAction,
  sendInvoiceEmailAction,
} from "@/app/actions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import InvoiceForm from "./InvoiceForm";
import Modal from "./Modal";

interface InvoiceDetailViewProps {
  invoice: Invoice;
  profile: BusinessProfile;
  clients: Client[];
  qrCodeDataUrl?: string | null;
}

const PAYMENT_METHODS: { value: Payment["method"]; label: string }[] = [
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
  partial: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
};

export default function InvoiceDetailView({ invoice: initialInvoice, profile, clients, qrCodeDataUrl }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [printDateTime, setPrintDateTime] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().substring(0, 10),
    amount: "",
    method: "bank" as Payment["method"],
    note: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    setPrintDateTime(now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  const isQuote = invoice.type === "quote";
  const currency = invoice.currency || profile.currency;

  const handleStatusChange = async (newStatus: "draft" | "sent" | "accepted" | "declined" | "overdue") => {
    setStatusLoading(true);
    try {
      const res = await updateInvoiceStatusAction(invoice.id, newStatus);
      if (res.success) {
        setInvoice((prev) => ({ ...prev, status: newStatus }));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!confirm("Convert this quote into an invoice? This will generate a new invoice number and start a fresh payment trail.")) {
      return;
    }
    setStatusLoading(true);
    try {
      const res = await convertQuoteToInvoiceAction(invoice.id);
      if (res.success && res.invoice) {
        router.push(`/invoices/${res.invoice.id}`);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to convert quote to invoice");
    } finally {
      setStatusLoading(false);
    }
  };

  const openPaymentModal = (prefillFullBalance = false) => {
    setPaymentForm({
      date: new Date().toISOString().substring(0, 10),
      amount: prefillFullBalance ? String(invoice.balanceDue) : "",
      method: "bank",
      note: prefillFullBalance ? "Marked as fully paid" : "",
    });
    setPaymentError("");
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError("Enter a valid payment amount greater than 0");
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError("");
    try {
      const res = await recordPaymentAction(invoice.id, {
        date: paymentForm.date,
        amount: amt,
        method: paymentForm.method,
        note: paymentForm.note || null,
      });
      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        setIsPaymentModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Remove this payment record? The balance due will be recalculated.")) return;
    try {
      const res = await deletePaymentAction(invoice.id, paymentId);
      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Failed to remove payment");
    }
  };

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    if (!clients.find((c) => c.id === invoice.clientId)?.email) {
      setEmailFeedback({ type: "error", message: "This client doesn't have an email address on file. Add one from the Clients page." });
      return;
    }
    setEmailSending(true);
    setEmailFeedback(null);
    try {
      const res = await sendInvoiceEmailAction(invoice.id);
      if (res.success) {
        setEmailFeedback({ type: "success", message: `${isQuote ? "Quote" : "Invoice"} emailed successfully.` });
        router.refresh();
      } else {
        setEmailFeedback({ type: "error", message: res.error || "Failed to send email" });
      }
    } catch (err: any) {
      setEmailFeedback({ type: "error", message: err.message || "Failed to send email" });
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          handlePrint();
        } else if (key === "d") {
          e.preventDefault();
          const link = document.getElementById("download-pdf-link");
          if (link) link.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm print:hidden">
          <span className="text-sm font-semibold text-slate-500">Editing Mode</span>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" /> Cancel Edit
          </button>
        </div>
        <InvoiceForm profile={profile} initialClients={clients} invoice={invoice} />
      </div>
    );
  }

  const paidPercent = invoice.grandTotal > 0 ? Math.min(100, (invoice.amountPaid / invoice.grandTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Action Header Panel */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/invoices")}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-mono text-sm font-bold text-slate-500">{isQuote ? "Quote" : "Invoice"} Ledger</span>
          </div>

          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_STYLES[invoice.status])}>
            {invoice.status}
          </span>
        </div>

        {invoice.convertedToInvoiceId && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            This quote was accepted and converted.{" "}
            <Link href={`/invoices/${invoice.convertedToInvoiceId}`} className="underline font-bold">
              View the invoice
            </Link>
          </div>
        )}
        {invoice.convertedFromQuoteId && (
          <div className="p-3 bg-slate-50 border border-slate-100 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2">
            Generated from a quote.{" "}
            <Link href={`/invoices/${invoice.convertedFromQuoteId}`} className="underline font-bold">
              View original quote
            </Link>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              {invoice.invoiceNo}
            </h1>
            <p className="text-sm text-slate-550 mt-1">
              Created on {formatDate(invoice.createdAt)} &bull; Last updated {formatDate(invoice.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-end">
            {isQuote ? (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                <button
                  disabled={statusLoading || invoice.status === "sent"}
                  onClick={() => handleStatusChange("sent")}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", invoice.status === "sent" ? "bg-amber-50 text-amber-700" : "hover:bg-slate-100 text-slate-500 disabled:opacity-50")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Sent
                </button>
                <button
                  disabled={statusLoading || invoice.status === "accepted"}
                  onClick={() => handleStatusChange("accepted")}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", invoice.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-100 text-slate-500 disabled:opacity-50")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Accepted
                </button>
                <button
                  disabled={statusLoading || invoice.status === "declined"}
                  onClick={() => handleStatusChange("declined")}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", invoice.status === "declined" ? "bg-rose-50 text-rose-700" : "hover:bg-slate-100 text-slate-500 disabled:opacity-50")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Declined
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                <button
                  disabled={statusLoading || invoice.status === "sent" || invoice.status === "draft"}
                  onClick={() => handleStatusChange("sent")}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", invoice.status === "sent" ? "bg-amber-50 text-amber-700" : "hover:bg-slate-100 text-slate-500 disabled:opacity-50")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Sent
                </button>
                <button
                  disabled={statusLoading || invoice.balanceDue <= 0 || invoice.status === "overdue"}
                  onClick={() => handleStatusChange("overdue")}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", invoice.status === "overdue" ? "bg-rose-50 text-rose-700" : "hover:bg-slate-100 text-slate-500 disabled:opacity-50")}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Overdue
                </button>
              </div>
            )}

            {isQuote && invoice.status !== "declined" && !invoice.convertedToInvoiceId && (
              <button
                disabled={statusLoading}
                onClick={handleConvertToInvoice}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                <ArrowRightCircle className="h-4 w-4" />
                Convert to Invoice
              </button>
            )}

            {!isQuote && invoice.balanceDue > 0 && (
              <>
                <button
                  onClick={() => openPaymentModal(false)}
                  className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Record Payment
                </button>
                <button
                  onClick={() => openPaymentModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Fully Paid
                </button>
              </>
            )}

            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>

            <a
              id="download-pdf-link"
              href={`/api/invoices/${invoice.id}/pdf`}
              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>

            <button
              onClick={handleSendEmail}
              disabled={emailSending}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Email to Client
            </button>
          </div>
        </div>

        {emailFeedback && (
          <div
            className={cn(
              "p-3 text-xs font-semibold rounded-xl border print:hidden",
              emailFeedback.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-700"
            )}
          >
            {emailFeedback.message}
          </div>
        )}

        {/* Payment progress + ledger (invoices only) */}
        {!isQuote && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-6">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Paid</div>
                  <div className="text-lg font-black text-emerald-600">{formatCurrency(invoice.amountPaid, currency)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balance Due</div>
                  <div className={cn("text-lg font-black", invoice.balanceDue > 0 ? "text-rose-600" : "text-slate-400")}>
                    {formatCurrency(Math.max(invoice.balanceDue, 0), currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grand Total</div>
                  <div className="text-lg font-black text-slate-900">{formatCurrency(invoice.grandTotal, currency)}</div>
                </div>
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div style={{ width: `${paidPercent}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all" />
            </div>

            {invoice.payments.length > 0 && (
              <div className="divide-y divide-slate-100 pt-2 border-t border-slate-50">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{formatCurrency(p.amount, currency)}</span>
                      <span className="text-slate-400 ml-2">
                        {formatDate(p.date)} &bull; {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}
                      </span>
                      {p.note && <div className="text-[10px] text-slate-400 mt-0.5">{p.note}</div>}
                    </div>
                    <button onClick={() => handleDeletePayment(p.id)} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100" title="Remove payment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice / Quote Document */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto print:border-0 print:shadow-none print:p-0 print:mx-0 print:w-full text-slate-800 relative font-sans text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b-2 border-slate-800 pb-6">
          <div className="flex items-start gap-4">
            {profile.logoUrl && (
              <img src={profile.logoUrl} alt={profile.name} className="h-16 w-auto object-contain shrink-0 bg-slate-50 p-1.5 rounded-xl border border-slate-100 print:bg-transparent print:border-0" />
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{profile.name}</h2>
              {profile.tagline && <p className="text-[10px] text-slate-500 font-bold italic tracking-wide mt-0.5">{profile.tagline}</p>}
              <div className="text-slate-600 mt-2.5 space-y-0.5">
                {profile.address && <p>{profile.address}</p>}
                <p>{[profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}</p>
                <p className="font-medium">
                  {profile.phone && `Phone: ${profile.phone}`}
                  {profile.phone && profile.email && " • "}
                  {profile.email && `Email: ${profile.email}`}
                </p>
                {profile.taxId && <p className="font-mono font-bold text-slate-900 text-xs mt-1">Tax ID: {profile.taxId}</p>}
              </div>
            </div>
          </div>

          <div className="sm:text-right flex flex-col justify-between items-start sm:items-end">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block text-sm font-black uppercase tracking-wider">
              {isQuote ? "QUOTE" : "INVOICE"}
            </div>
            <div className="mt-4 sm:mt-0 text-slate-650 space-y-1">
              <div>
                <span className="text-[10px] text-slate-450 font-bold uppercase block sm:inline">{isQuote ? "Quote No: " : "Invoice No: "}</span>
                <span className="font-black text-slate-900 text-sm font-mono">{invoice.invoiceNo}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-450 font-bold uppercase block sm:inline">{isQuote ? "Quote Date: " : "Invoice Date: "}</span>
                <span className="font-bold text-slate-800">{formatDate(invoice.invoiceDate)}</span>
              </div>
              {invoice.dueDate && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block sm:inline">{isQuote ? "Valid Until: " : "Due Date: "}</span>
                  <span className="font-semibold text-slate-700">{formatDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 py-5">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bill To</div>
          <h3 className="font-black text-slate-900 text-sm">{invoice.clientSnapshot.name}</h3>
          {invoice.clientSnapshot.companyName && <p className="text-slate-600">{invoice.clientSnapshot.companyName}</p>}
          {invoice.clientSnapshot.address && <p className="text-slate-600">{invoice.clientSnapshot.address}</p>}
          {invoice.clientSnapshot.taxId && (
            <p className="font-mono font-bold text-slate-900 mt-1">Tax ID: {invoice.clientSnapshot.taxId}</p>
          )}
        </div>

        <div className="py-6 overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border border-slate-200">
              <tr className="print:bg-slate-100">
                <th className="py-2 px-3 border border-slate-200 text-center w-8">Sl</th>
                <th className="py-2 px-3 border border-slate-200">Description</th>
                <th className="py-2 px-3 border border-slate-200 text-right w-16">Qty</th>
                <th className="py-2 px-3 border border-slate-200 text-center w-16">Unit</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Rate</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Disc %</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Taxable</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Tax</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.slNo} className="hover:bg-slate-50/50 print:break-inside-avoid">
                  <td className="py-2.5 px-3 border border-slate-200 text-center">{item.slNo}</td>
                  <td className="py-2.5 px-3 border border-slate-200 font-bold text-slate-900">{item.description}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">{item.quantity}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-center text-slate-500 uppercase text-[9px] font-semibold">
                    {item.unit}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">{formatCurrency(item.rate, currency)}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">
                    {item.discountPercent > 0 ? `${item.discountPercent}%` : "-"}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">{formatCurrency(item.taxableValue, currency)}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">
                    {item.taxAmount > 0 ? formatCurrency(item.taxAmount, currency) : "-"}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right font-bold text-slate-900">
                    {formatCurrency(item.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start border-t border-slate-200 pt-6 print:break-inside-avoid">
          <div className="sm:col-span-7 space-y-4">
            {invoice.notes && (
              <div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Notes</div>
                <div className="text-slate-700 mt-1 leading-snug whitespace-pre-line">{invoice.notes}</div>
              </div>
            )}

            {!isQuote && (invoice.paymentInstructions || profile.bank.accountNo || profile.upiId || profile.qrCodeUrl || qrCodeDataUrl) && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 print:bg-white print:break-inside-avoid">
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-slate-400" /> Payment Details
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    {invoice.paymentInstructions && (
                      <p className="text-slate-700 whitespace-pre-line">{invoice.paymentInstructions}</p>
                    )}
                    {profile.bank.accountNo && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700 pt-1">
                        {profile.bank.bankName && (
                          <div>
                            <span className="text-[9px] text-slate-400 font-medium block">Bank Name</span>
                            <span className="font-bold text-slate-800 text-[11px]">{profile.bank.bankName}</span>
                          </div>
                        )}
                        {profile.bank.accountNo && (
                          <div>
                            <span className="text-[9px] text-slate-400 font-medium block">Account Number</span>
                            <span className="font-bold text-slate-900 text-[11px] font-mono">{profile.bank.accountNo}</span>
                          </div>
                        )}
                        {profile.bank.ifscOrSwift && (
                          <div>
                            <span className="text-[9px] text-slate-400 font-medium block">IFSC / SWIFT</span>
                            <span className="font-bold text-slate-900 text-[11px] font-mono">{profile.bank.ifscOrSwift}</span>
                          </div>
                        )}
                        {profile.bank.branch && (
                          <div>
                            <span className="text-[9px] text-slate-400 font-medium block">Branch</span>
                            <span className="font-bold text-slate-800 text-[11px]">{profile.bank.branch}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {profile.upiId && (
                      <div>
                        <span className="text-[9px] text-slate-400 font-medium block">UPI ID</span>
                        <span className="font-bold text-slate-900 text-[11px] font-mono">{profile.upiId}</span>
                      </div>
                    )}
                  </div>
                  {(profile.qrCodeUrl || qrCodeDataUrl) && (
                    <div className="shrink-0 flex flex-col items-center gap-1 print:break-inside-avoid">
                      <img
                        src={profile.qrCodeUrl || qrCodeDataUrl || ""}
                        alt="Scan to pay"
                        className="h-24 w-24 object-contain bg-white border border-slate-200 rounded-lg p-1"
                      />
                      <span className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-0.5">
                        <QrCode className="h-2.5 w-2.5" /> Scan to Pay
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sm:col-span-5 border border-slate-200 rounded-xl overflow-hidden text-sm print:break-inside-avoid">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider print:bg-slate-100">
              Totals
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(invoice.subtotal, currency)}</span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Total Discount:</span>
                  <span className="font-semibold text-rose-500">-{formatCurrency(invoice.totalDiscount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-2">
                <span>Taxable Value:</span>
                <span>{formatCurrency(invoice.taxableValueTotal, currency)}</span>
              </div>
              {invoice.taxTotal > 0 && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Tax Total:</span>
                  <span>{formatCurrency(invoice.taxTotal, currency)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-3 mt-1.5">
                <span className="font-black text-slate-900">Grand Total:</span>
                <span className="text-xl font-black text-indigo-700">{formatCurrency(invoice.grandTotal, currency)}</span>
              </div>

              {!isQuote && invoice.amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-emerald-600 font-semibold border-t border-slate-100 pt-2">
                    <span>Amount Paid:</span>
                    <span>-{formatCurrency(invoice.amountPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-black text-slate-900">Balance Due:</span>
                    <span className={cn("text-lg font-black", invoice.balanceDue > 0 ? "text-rose-600" : "text-emerald-600")}>
                      {formatCurrency(Math.max(invoice.balanceDue, 0), currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end border-t border-slate-300 pt-8 mt-8 text-[10px] text-slate-600 print:break-inside-avoid">
          <div>
            {isQuote && (
              <p className="text-slate-400 leading-relaxed">
                This quote is valid until the date above. Prices and availability are subject to confirmation after this period.
              </p>
            )}
          </div>
          <div className="sm:text-right space-y-12">
            <div>
              <span className="text-slate-400 font-semibold block">for</span>
              <span className="font-bold text-slate-900 block">{profile.name}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-300 font-medium uppercase tracking-wider mt-12 pt-6 border-t border-slate-100 relative">
          This is a computer generated {isQuote ? "quote" : "invoice"}.
          {printDateTime && (
            <div className="hidden print:block absolute right-0 bottom-0 text-[8px] text-slate-400 font-mono font-bold lowercase tracking-normal">
              printed on: {printDateTime}
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold">{paymentError}</div>
          )}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex justify-between">
            <span>Balance due:</span>
            <span className="font-bold text-slate-900">{formatCurrency(invoice.balanceDue, currency)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Date *</label>
              <input
                type="date"
                required
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Amount *</label>
              <input
                type="number"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Method *</label>
            <select
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, method: e.target.value as Payment["method"] }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs font-semibold text-slate-800 outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Advance / milestone 1"
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
            />
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2.5 border border-slate-250 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentSubmitting}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold hover:shadow-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {paymentSubmitting ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
