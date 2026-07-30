"use client";

import React, { useState, useEffect, useRef } from "react";
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
  BellRing,
  MoreHorizontal,
} from "lucide-react";
import { Invoice, BusinessProfile, Client, Payment } from "@/lib/types";
import {
  updateInvoiceStatusAction,
  convertQuoteToInvoiceAction,
  recordPaymentAction,
  deletePaymentAction,
  sendInvoiceEmailAction,
  sendPaymentReminderAction,
} from "@/app/actions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import InvoiceForm from "./InvoiceForm";
import Modal from "./Modal";

interface InvoiceDetailViewProps {
  invoice: Invoice;
  profile: BusinessProfile;
  clients: Client[];
  qrCodeDataUrl?: string | null;
  upiUri?: string | null;
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

export default function InvoiceDetailView({ invoice: initialInvoice, profile, clients, qrCodeDataUrl, upiUri }: InvoiceDetailViewProps) {
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
  const [reminderSending, setReminderSending] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setPrintDateTime(now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const isQuote = invoice.type === "quote";
  const currency = invoice.currency || profile.currency;

  const handleStatusChange = async (newStatus: "draft" | "sent" | "accepted" | "declined" | "overdue") => {
    setStatusLoading(true);
    try {
      const res = await updateInvoiceStatusAction(invoice.id, newStatus);
      if (res.success) {
        setInvoice((prev) => ({ ...prev, status: newStatus }));
        router.refresh();
      } else {
        alert(res.error || "Failed to update status");
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
      } else if (!res.success) {
        alert(res.error || "Failed to convert quote to invoice");
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
      } else if (!res.success) {
        setPaymentError(res.error || "Failed to record payment");
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
      } else if (!res.success) {
        alert(res.error || "Failed to remove payment");
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

  const handleSendReminder = async () => {
    if (!clients.find((c) => c.id === invoice.clientId)?.email) {
      setEmailFeedback({ type: "error", message: "This client doesn't have an email address on file. Add one from the Clients page." });
      return;
    }
    setReminderSending(true);
    setEmailFeedback(null);
    try {
      const res = await sendPaymentReminderAction(invoice.id);
      if (res.success) {
        setEmailFeedback({ type: "success", message: "Payment reminder emailed successfully." });
        setInvoice((prev) => ({ ...prev, lastReminderSentAt: new Date().toISOString(), reminderCount: (prev.reminderCount || 0) + 1 }));
        router.refresh();
      } else {
        setEmailFeedback({ type: "error", message: res.error || "Failed to send reminder" });
      }
    } catch (err: any) {
      setEmailFeedback({ type: "error", message: err.message || "Failed to send reminder" });
    } finally {
      setReminderSending(false);
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
          const link = document.getElementById("download-pdf-link") || document.getElementById("download-pdf-link-mobile");
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:self-end">
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

            {/* Mobile: a single non-wrapping row so the "More" trigger always
                lands at a predictable spot near the right edge - when it was
                free to wrap with everything else, it could end up alone on
                the far left of a new line, and its right-anchored dropdown
                would then render mostly off-screen to the left. */}
            <div className="flex items-center gap-2 sm:hidden">
              {isQuote && invoice.status !== "declined" && !invoice.convertedToInvoiceId && (
                <button
                  disabled={statusLoading}
                  onClick={handleConvertToInvoice}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  <ArrowRightCircle className="h-4 w-4" />
                  Convert
                </button>
              )}
              {!isQuote && invoice.balanceDue > 0 && (
                <button
                  onClick={() => openPaymentModal(false)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Record Payment
                </button>
              )}
              <a
                id="download-pdf-link-mobile"
                href={`/api/invoices/${invoice.id}/pdf`}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors shrink-0",
                  isQuote && invoice.status === "declined" && "flex-1",
                  isQuote && invoice.convertedToInvoiceId && "flex-1",
                  !isQuote && invoice.balanceDue <= 0 && "flex-1"
                )}
              >
                <Download className="h-4 w-4" />
                PDF
              </a>
              <div className="relative shrink-0" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  aria-label="More actions"
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-1.5 overflow-hidden">
                    {!isQuote && invoice.balanceDue > 0 && (
                      <button
                        onClick={() => {
                          setMoreOpen(false);
                          openPaymentModal(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 text-left"
                      >
                        <CheckCircle className="h-4 w-4" /> Mark Fully Paid
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        setIsEditing(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Edit2 className="h-4 w-4" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        handlePrint();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Printer className="h-4 w-4" /> Print
                    </button>
                    <button
                      onClick={() => {
                        setMoreOpen(false);
                        handleSendEmail();
                      }}
                      disabled={emailSending}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 text-left disabled:opacity-60"
                    >
                      {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email to Client
                    </button>
                    {!isQuote && invoice.balanceDue > 0 && (
                      <button
                        onClick={() => {
                          setMoreOpen(false);
                          handleSendReminder();
                        }}
                        disabled={reminderSending}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 text-left disabled:opacity-60"
                      >
                        {reminderSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Send Reminder
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: everything inline, no collapsing needed - there's room. */}
            <div className="hidden sm:contents">
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
                <button
                  onClick={() => openPaymentModal(false)}
                  className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Record Payment
                </button>
              )}
              <a
                id="download-pdf-link"
                href={`/api/invoices/${invoice.id}/pdf`}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
              {!isQuote && invoice.balanceDue > 0 && (
                <button
                  onClick={() => openPaymentModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Fully Paid
                </button>
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
              <button
                onClick={handleSendEmail}
                disabled={emailSending}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email to Client
              </button>
              {!isQuote && invoice.balanceDue > 0 && (
                <button
                  onClick={handleSendReminder}
                  disabled={reminderSending}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  {reminderSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                  Send Reminder
                </button>
              )}
            </div>
          </div>
        </div>

        {!isQuote && invoice.balanceDue > 0 && invoice.lastReminderSentAt && (
          <p className="text-xs text-slate-400 font-medium -mt-2">
            Last reminder sent {formatDate(invoice.lastReminderSentAt)}
            {invoice.reminderCount ? ` • ${invoice.reminderCount} reminder${invoice.reminderCount > 1 ? "s" : ""} sent total` : ""}
          </p>
        )}

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

            {!profile.upiId && !profile.qrCodeUrl && !qrCodeDataUrl && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 font-semibold flex items-center gap-2">
                <QrCode className="h-4 w-4 shrink-0" />
                No payment QR yet — add a UPI ID in{" "}
                <Link href="/settings" className="underline font-bold">
                  Settings
                </Link>{" "}
                and it'll appear automatically on this invoice.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice / Quote Document */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm max-w-4xl mx-auto print:border-0 print:shadow-none print:mx-0 print:w-full text-slate-800 relative font-sans text-xs overflow-hidden print:overflow-visible">
        <div className="h-1.5 bg-indigo-600 print:hidden" />
        <div className="p-6 sm:p-10 print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6">
            <div className="flex items-center gap-3.5">
              {profile.logoUrl && invoice.display.showLogo && (
                <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 print:border-slate-200">
                  <img src={profile.logoUrl} alt={profile.name} className="h-full w-full object-contain" />
                </div>
              )}
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">{profile.name}</h2>
                {profile.tagline && <p className="text-[10px] text-slate-400 font-bold italic tracking-wide mt-0.5">{profile.tagline}</p>}
              </div>
            </div>

            <div className="sm:text-right flex flex-col sm:items-end gap-1.5">
              <span className="inline-flex self-start sm:self-end bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-widest">
                {isQuote ? "Quote" : "Invoice"}
              </span>
              <div className="font-mono font-black text-slate-900 text-sm mt-1">{invoice.invoiceNo}</div>
              <div className="text-[10px] text-slate-400 font-semibold">
                Date: <span className="text-slate-700 font-bold">{formatDate(invoice.invoiceDate)}</span>
              </div>
              {invoice.dueDate && (
                <div className="text-[10px] text-slate-400 font-semibold">
                  {isQuote ? "Valid Until" : "Due"}: <span className="text-slate-700 font-bold">{formatDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-t border-slate-100">
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">From</div>
              <h3 className="font-black text-slate-900 text-sm">{profile.name}</h3>
              {profile.address && <p className="text-slate-500 mt-0.5">{profile.address}</p>}
              <p className="text-slate-500">{[profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}</p>
              <p className="text-slate-500">
                {profile.phone}
                {profile.phone && profile.email && " • "}
                {profile.email}
              </p>
              {profile.taxId && <p className="font-mono font-bold text-slate-800 mt-1">Tax ID: {profile.taxId}</p>}
            </div>
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Bill To</div>
              <h3 className="font-black text-slate-900 text-sm">{invoice.clientSnapshot.name}</h3>
              {invoice.clientSnapshot.companyName && <p className="text-slate-500 mt-0.5">{invoice.clientSnapshot.companyName}</p>}
              {invoice.clientSnapshot.address && <p className="text-slate-500">{invoice.clientSnapshot.address}</p>}
              {invoice.clientSnapshot.email && <p className="text-slate-500">{invoice.clientSnapshot.email}</p>}
              {invoice.clientSnapshot.taxId && (
                <p className="font-mono font-bold text-slate-800 mt-1">Tax ID: {invoice.clientSnapshot.taxId}</p>
              )}
            </div>
          </div>

          {/* Line items: a full data table on tablet/desktop/print, a stacked
              card list on phones - an 8-column table has no readable way to
              fit a ~375px screen, even with horizontal scroll (the amount
              column, the one figure that matters most, ends up hidden
              off-screen by default). */}
          <div className="hidden sm:block py-2 overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-indigo-50/70 print:bg-indigo-50">
                  <th className="py-2.5 px-3 text-center w-8 text-[9px] font-black text-indigo-700 uppercase tracking-wide rounded-l-md">Sl</th>
                  <th className="py-2.5 px-3 text-[9px] font-black text-indigo-700 uppercase tracking-wide">Description</th>
                  <th className="py-2.5 px-3 text-right w-14 text-[9px] font-black text-indigo-700 uppercase tracking-wide">Qty</th>
                  <th className="py-2.5 px-3 text-center w-14 text-[9px] font-black text-indigo-700 uppercase tracking-wide">Unit</th>
                  <th className="py-2.5 px-3 text-right text-[9px] font-black text-indigo-700 uppercase tracking-wide">Rate</th>
                  <th className="py-2.5 px-3 text-right text-[9px] font-black text-indigo-700 uppercase tracking-wide rounded-r-md">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item) => (
                  <tr key={item.slNo} className="border-b border-slate-100 print:break-inside-avoid">
                    <td className="py-3 px-3 text-center text-slate-400">{item.slNo}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {item.description}
                      {item.discountPercent > 0 && (
                        <span className="ml-1.5 text-[10px] font-semibold text-rose-500">(-{item.discountPercent}%)</span>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 mt-0.5"
                        >
                          {item.url}
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.quantity}</td>
                    <td className="py-3 px-3 text-center text-slate-400 uppercase text-[9px] font-semibold">{item.unit}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(item.rate, currency)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden py-2 space-y-3">
            {invoice.lineItems.map((item) => (
              <div key={item.slNo} className="border-b border-slate-100 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs">{item.description}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {item.quantity} {item.unit} &times; {formatCurrency(item.rate, currency)}
                      {item.discountPercent > 0 && <span className="text-rose-500"> &bull; -{item.discountPercent}%</span>}
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 mt-0.5 truncate"
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-slate-900 text-xs">{formatCurrency(item.amount, currency)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start pt-6 print:break-inside-avoid">
            <div className="sm:col-span-7 space-y-4">
              {invoice.notes && invoice.display.showNotes && (
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Notes</div>
                  <div className="text-slate-600 mt-1 leading-snug whitespace-pre-line">{invoice.notes}</div>
                </div>
              )}

              {!isQuote &&
                invoice.display.showPaymentDetails &&
                (invoice.paymentInstructions || profile.bank.accountNo || profile.upiId || profile.qrCodeUrl || qrCodeDataUrl) && (
                <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl print:bg-white print:border-slate-200 print:break-inside-avoid">
                  <div className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1 mb-2.5">
                    <Wallet className="h-3.5 w-3.5" /> Payment Details
                  </div>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                    <div className="flex-1 w-full space-y-2">
                      {invoice.paymentInstructions && (
                        <p className="text-slate-600 whitespace-pre-line">{invoice.paymentInstructions}</p>
                      )}
                      {profile.bank.accountNo && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
                          {profile.bank.bankName && (
                            <div>
                              <span className="text-[9px] text-slate-400 font-medium block">Bank</span>
                              <span className="font-bold text-slate-800 text-[11px]">{profile.bank.bankName}</span>
                            </div>
                          )}
                          {profile.bank.accountName && (
                            <div>
                              <span className="text-[9px] text-slate-400 font-medium block">Account Holder</span>
                              <span className="font-bold text-slate-800 text-[11px]">{profile.bank.accountName}</span>
                            </div>
                          )}
                          {profile.bank.accountNo && (
                            <div>
                              <span className="text-[9px] text-slate-400 font-medium block">Account No.</span>
                              <span className="font-bold text-slate-900 text-[11px] font-mono">{profile.bank.accountNo}</span>
                            </div>
                          )}
                          {profile.bank.ifscOrSwift && (
                            <div>
                              <span className="text-[9px] text-slate-400 font-medium block">IFSC</span>
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
                          {upiUri ? (
                            <a href={upiUri} className="font-bold text-indigo-600 hover:text-indigo-700 text-[11px] font-mono underline underline-offset-2">
                              {profile.upiId}
                            </a>
                          ) : (
                            <span className="font-bold text-slate-900 text-[11px] font-mono">{profile.upiId}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {(profile.qrCodeUrl || qrCodeDataUrl) && (
                      <a
                        href={upiUri || undefined}
                        className={cn("shrink-0 flex flex-col items-center gap-1 print:break-inside-avoid", !upiUri && "pointer-events-none")}
                      >
                        <img
                          src={profile.qrCodeUrl || qrCodeDataUrl || ""}
                          alt="Scan to pay"
                          className="h-24 w-24 object-contain bg-white border border-slate-200 rounded-lg p-1"
                        />
                        <span className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-0.5">
                          <QrCode className="h-2.5 w-2.5" /> Tap or Scan to Pay
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sm:col-span-5 text-sm print:break-inside-avoid">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(invoice.subtotal, currency)}</span>
                </div>
                {invoice.totalDiscount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Discount</span>
                    <span className="font-semibold text-rose-500">-{formatCurrency(invoice.totalDiscount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t-2 border-indigo-600 pt-3 mt-1">
                  <span className="font-black text-slate-900 text-sm">Grand Total</span>
                  <span className="text-2xl font-black text-indigo-700">{formatCurrency(invoice.grandTotal, currency)}</span>
                </div>

                {!isQuote && invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-[11px] text-emerald-600 font-semibold">
                      <span>Amount Paid</span>
                      <span>-{formatCurrency(invoice.amountPaid, currency)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-black text-slate-900">Balance Due</span>
                      <span className={cn("text-lg font-black", invoice.balanceDue > 0 ? "text-rose-600" : "text-emerald-600")}>
                        {formatCurrency(Math.max(invoice.balanceDue, 0), currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end border-t border-slate-100 pt-6 mt-6 text-[10px] text-slate-500 print:break-inside-avoid">
            <div>
              {isQuote && (
                <p className="text-slate-400 leading-relaxed">
                  This quote is valid until the date above. Prices and availability are subject to confirmation after this period.
                </p>
              )}
            </div>
            <div className="sm:text-right space-y-10">
              <div>
                <span className="text-slate-400 font-semibold block">For</span>
                <span className="font-bold text-slate-900 block">{profile.name}</span>
              </div>
            </div>
          </div>

          <div className="text-center text-[9px] text-slate-300 font-medium uppercase tracking-wider mt-8 pt-4 border-t border-slate-50 relative">
            This is a computer generated {isQuote ? "quote" : "invoice"}.
            {printDateTime && (
              <div className="hidden print:block absolute right-0 bottom-0 text-[8px] text-slate-400 font-mono font-bold lowercase tracking-normal">
                printed on: {printDateTime}
              </div>
            )}
          </div>
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
