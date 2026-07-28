"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { Client, BusinessProfile, Invoice } from "@/lib/types";
import { createInvoiceAction, updateInvoiceAction } from "@/app/actions";
import { formatCurrency, cn } from "@/lib/utils";
import ClientDialog from "./ClientDialog";

const UNIT_SUGGESTIONS = ["hrs", "days", "words", "pages", "sessions", "project", "unit", "pcs"];

interface InvoiceFormProps {
  profile: BusinessProfile;
  initialClients: Client[];
  invoice?: Invoice | null;
  preselectedClientId?: string;
  preselectedType?: "quote" | "invoice";
}

interface FormLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  taxPercent: number;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function InvoiceForm({ profile, initialClients, invoice, preselectedClientId, preselectedType }: InvoiceFormProps) {
  const router = useRouter();
  const isEditMode = !!invoice;

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const [docType, setDocType] = useState<"quote" | "invoice">(invoice?.type || preselectedType || "invoice");

  const [selectedClientId, setSelectedClientId] = useState(invoice?.clientId || preselectedClientId || "");
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoiceDate ? invoice.invoiceDate.split("T")[0] : todayIso()
  );
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? invoice.dueDate.split("T")[0]
      : addDaysIso(docType === "quote" ? profile.defaultQuoteValidityDays : profile.defaultPaymentDueDays)
  );
  const [status, setStatus] = useState<"draft" | "sent" | "accepted" | "declined">(invoice?.status === "accepted" || invoice?.status === "declined" ? invoice.status : invoice?.status === "draft" ? "draft" : "sent");
  const [notes, setNotes] = useState(invoice?.notes || profile.termsAndConditions || "");
  const [paymentInstructions, setPaymentInstructions] = useState(
    invoice?.paymentInstructions || profile.paymentInstructions || ""
  );

  const [showLogo, setShowLogo] = useState(invoice?.display?.showLogo !== false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(invoice?.display?.showPaymentDetails !== false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(invoice?.display?.showTaxBreakdown !== false);
  const [showNotes, setShowNotes] = useState(invoice?.display?.showNotes !== false);

  const [lineItems, setLineItems] = useState<FormLineItem[]>(() => {
    if (invoice && invoice.lineItems) {
      return invoice.lineItems.map((item) => ({
        id: String(item.slNo),
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discountPercent: item.discountPercent,
        taxPercent: item.taxPercent,
      }));
    }
    return [
      {
        id: "1",
        description: "",
        quantity: 1,
        unit: "hrs",
        rate: 0,
        discountPercent: 0,
        taxPercent: profile.defaultTaxPercent || 0,
      },
    ];
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentClient = clients.find((c) => c.id === selectedClientId);

  const handleDocTypeChange = (next: "quote" | "invoice") => {
    setDocType(next);
    if (!isEditMode) {
      setDueDate(addDaysIso(next === "quote" ? profile.defaultQuoteValidityDays : profile.defaultPaymentDueDays));
    }
  };

  const handleClientAdded = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    setSelectedClientId(newClient.id);
  };

  const addLineItem = () => {
    const nextId = "item_" + Math.random().toString(36).substring(2, 9);
    setLineItems([
      ...lineItems,
      {
        id: nextId,
        description: "",
        quantity: 1,
        unit: "hrs",
        rate: 0,
        discountPercent: 0,
        taxPercent: profile.defaultTaxPercent || 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, fields: Partial<FormLineItem>) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, ...fields } : item)));
  };

  // Live calculations
  let calculatedSubtotal = 0;
  let calculatedTotalDiscount = 0;
  let calculatedTaxableValueTotal = 0;
  let calculatedTaxTotal = 0;

  const processedLines = lineItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPercent = Number(item.discountPercent) || 0;
    const taxPercent = Number(item.taxPercent) || 0;

    const rowSubtotal = qty * rate;
    const rowDiscount = rowSubtotal * (discPercent / 100);
    const rowTaxable = Math.round((rowSubtotal - rowDiscount + Number.EPSILON) * 100) / 100;
    const rowTax = Math.round((rowTaxable * (taxPercent / 100) + Number.EPSILON) * 100) / 100;
    const rowTotal = Math.round((rowTaxable + rowTax + Number.EPSILON) * 100) / 100;

    calculatedSubtotal += rowSubtotal;
    calculatedTotalDiscount += rowDiscount;
    calculatedTaxableValueTotal += rowTaxable;
    calculatedTaxTotal += rowTax;

    return { taxable: rowTaxable, tax: rowTax, total: rowTotal };
  });

  calculatedSubtotal = Math.round((calculatedSubtotal + Number.EPSILON) * 100) / 100;
  calculatedTotalDiscount = Math.round((calculatedTotalDiscount + Number.EPSILON) * 100) / 100;
  calculatedTaxableValueTotal = Math.round((calculatedTaxableValueTotal + Number.EPSILON) * 100) / 100;
  calculatedTaxTotal = Math.round((calculatedTaxTotal + Number.EPSILON) * 100) / 100;
  const calculatedGrandTotal = Math.round((calculatedTaxableValueTotal + calculatedTaxTotal + Number.EPSILON) * 100) / 100;

  const handleSave = async () => {
    if (!selectedClientId) {
      setErrors({ clientId: "Please select a client" });
      return;
    }

    const validLineItems = lineItems.filter((l) => l.description.trim() !== "");
    if (validLineItems.length === 0) {
      setErrors({ lineItems: "Please add at least one line item with a description" });
      return;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      type: docType,
      invoiceDate: new Date(invoiceDate).toISOString(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      clientId: selectedClientId,
      lineItems: validLineItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit: item.unit,
        rate: Number(item.rate) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        taxPercent: Number(item.taxPercent) || 0,
      })),
      notes: notes || null,
      paymentInstructions: paymentInstructions || null,
      status,
      display: { showLogo, showPaymentDetails, showTaxBreakdown, showNotes },
    };

    try {
      let result;
      if (isEditMode && invoice) {
        result = await updateInvoiceAction(invoice.id, payload);
      } else {
        result = await createInvoiceAction(payload);
      }

      if (result.success && result.invoice) {
        router.push(`/invoices/${result.invoice.id}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrors({ general: err.message || "Failed to save invoice" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            {docType === "quote" ? "Quote Builder" : "Invoice Builder"}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isEditMode
                ? `Edit ${docType === "quote" ? "Quote" : "Invoice"} - ${invoice.invoiceNo}`
                : `Create New ${docType === "quote" ? "Quote" : "Invoice"}`}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {docType === "quote" ? "Send a proposal for a client to review and accept." : "Bill your client for work delivered."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Type:</span>
              <select
                value={docType}
                onChange={(e) => handleDocTypeChange(e.target.value as "quote" | "invoice")}
                disabled={isEditMode}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="invoice">Invoice</option>
                <option value="quote">Quote</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 self-start sm:self-auto">
              <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer capitalize"
              >
                <option value="draft">Draft</option>
                {docType === "quote" ? (
                  <>
                    <option value="sent">Sent to Client</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                  </>
                ) : (
                  <option value="sent">Sent / Awaiting Payment</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {docType === "invoice" && isEditMode && invoice && invoice.payments.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-xl">
          This invoice already has {invoice.payments.length} payment{invoice.payments.length > 1 ? "s" : ""} recorded
          ({formatCurrency(invoice.amountPaid, profile.currency)} paid). Editing line items will recalculate the balance due.
        </div>
      )}

      {errors.general && (
        <div className="p-4 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl">{errors.general}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Dates Block */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center justify-between">
              <span>Client Details</span>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Quick-Add Client
              </button>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Client *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                    errors.clientId ? "border-rose-400 focus:border-rose-500" : "border-slate-200"
                  )}
                >
                  <option value="">-- Choose client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.companyName ? ` (${c.companyName})` : ""}
                    </option>
                  ))}
                </select>
                {errors.clientId && <span className="text-xs text-rose-500 mt-1">{errors.clientId}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {docType === "quote" ? "Quote Date" : "Invoice Date"}
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {docType === "quote" ? "Valid Until" : "Due Date"}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-800"
                />
              </div>
            </div>

            {currentClient && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Bill To</div>
                <div className="text-sm font-bold text-slate-900">{currentClient.name}</div>
                {currentClient.companyName && (
                  <div className="text-xs text-slate-500">{currentClient.companyName}</div>
                )}
                <div className="text-xs text-slate-500">
                  {[currentClient.address, currentClient.city, currentClient.state, currentClient.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                {currentClient.taxId && (
                  <div className="text-xs font-mono font-bold text-slate-800 mt-1">Tax ID: {currentClient.taxId}</div>
                )}
              </div>
            )}
          </div>

          {/* Line Items Block */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Line Items</h2>

            {errors.lineItems && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{errors.lineItems}</div>
            )}

            <div className="space-y-4">
              {lineItems.map((item, index) => {
                const calc = processedLines[index];
                return (
                  <div key={item.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-400">Item {index + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. UI design for landing page"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                        className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Qty / Hours
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          list="unit-suggestions"
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, { unit: e.target.value })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Rate
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.rate}
                          onChange={(e) => updateLineItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Discount %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discountPercent}
                          onChange={(e) =>
                            updateLineItem(item.id, { discountPercent: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Tax %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.taxPercent}
                          onChange={(e) => updateLineItem(item.id, { taxPercent: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500 font-semibold">
                      <span>Taxable: {formatCurrency(calc.taxable, profile.currency)}</span>
                      {calc.tax > 0 && <span>Tax: {formatCurrency(calc.tax, profile.currency)}</span>}
                      <span className="text-slate-800 font-extrabold">
                        Line Total: {formatCurrency(calc.total, profile.currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>

            <button
              type="button"
              onClick={addLineItem}
              className="w-full py-3 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 text-slate-700 hover:text-indigo-600 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 bg-white shadow-sm"
            >
              <Plus className="h-4.5 w-4.5" />
              Add Line Item
            </button>
          </div>

          {/* Notes & Payment Instructions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Notes & Terms</h2>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Notes / Terms shown on invoice
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Payment Instructions
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Bank transfer, UPI, PayPal details..."
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none bg-white"
              />
            </div>
          </div>

          {/* Print / Section Visibility Options */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">
              What Shows On This {docType === "quote" ? "Quote" : "Invoice"}
            </h2>
            <p className="text-xs text-slate-400 -mt-1">
              Control which sections appear on the printed/PDF/emailed document. Toggle off anything you don't need.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700">Logo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showPaymentDetails}
                  onChange={(e) => setShowPaymentDetails(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700">Payment Details / QR</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showTaxBreakdown}
                  onChange={(e) => setShowTaxBreakdown(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700">Tax Breakdown</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showNotes}
                  onChange={(e) => setShowNotes(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700">Notes / Terms</span>
              </label>
            </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-6 lg:sticky lg:top-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Invoice Summary</span>
              <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(calculatedSubtotal, profile.currency)}</span>
              </div>
              {calculatedTotalDiscount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Total Discount:</span>
                  <span className="font-semibold text-rose-400">-{formatCurrency(calculatedTotalDiscount, profile.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300 font-bold border-t border-slate-800 pt-2">
                <span>Taxable Value:</span>
                <span>{formatCurrency(calculatedTaxableValueTotal, profile.currency)}</span>
              </div>
              {calculatedTaxTotal > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Tax Total:</span>
                  <span>{formatCurrency(calculatedTaxTotal, profile.currency)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline border-t border-slate-800 pt-4 mt-2">
                <span className="text-base font-bold text-slate-200">Grand Total:</span>
                <span className="text-3xl font-black text-white tracking-tight">
                  {formatCurrency(calculatedGrandTotal, profile.currency)}
                </span>
              </div>
            </div>

            <button
              id="submit-invoice-btn"
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isEditMode ? "Save Changes" : docType === "quote" ? "Create Quote" : "Create Invoice"}
            </button>
          </div>
        </div>
      </div>

      <ClientDialog isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onSuccess={handleClientAdded} />
    </div>
  );
}
