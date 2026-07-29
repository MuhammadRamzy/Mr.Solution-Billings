"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Trash2,
  FileText,
} from "lucide-react";
import { Invoice, Client, BusinessProfile } from "@/lib/types";
import { formatCurrency, formatDate, cn, exportToCsv } from "@/lib/utils";
import { deleteInvoiceAction } from "@/app/actions";

interface InvoicesListProps {
  initialInvoices: Invoice[];
  clients: Client[];
  profile: BusinessProfile;
}

const ITEMS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
  partial: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-rose-50 text-rose-700",
};

export default function InvoicesList({ initialInvoices, clients, profile }: InvoicesListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "invoice_no">("date_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [
    selectedType !== "all",
    selectedStatus !== "all",
    selectedClientId !== "all",
    !!startDate,
    !!endDate,
  ].filter(Boolean).length;

  const filteredInvoices = invoices
    .filter((inv) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery = inv.invoiceNo.toLowerCase().includes(q) || inv.clientSnapshot.name.toLowerCase().includes(q);
      const matchesType = selectedType === "all" || inv.type === selectedType;
      const matchesStatus = selectedStatus === "all" || inv.status === selectedStatus;
      const matchesClient = selectedClientId === "all" || inv.clientId === selectedClientId;

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(inv.invoiceDate) >= new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(inv.invoiceDate) <= endOfDay;
      }

      return matchesQuery && matchesType && matchesStatus && matchesClient && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      if (sortBy === "date_asc") return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
      if (sortBy === "amount_desc") return b.grandTotal - a.grandTotal;
      if (sortBy === "amount_asc") return a.grandTotal - b.grandTotal;
      if (sortBy === "invoice_no") return a.invoiceNo.localeCompare(b.invoiceNo);
      return 0;
    });

  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedStatus, selectedClientId, startDate, endDate]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedStatus("all");
    setSelectedClientId("all");
    setStartDate("");
    setEndDate("");
    setSortBy("date_desc");
  };

  const handleDelete = async (id: string, no: string) => {
    if (confirm(`Are you sure you want to permanently delete invoice "${no}"?`)) {
      try {
        const res = await deleteInvoiceAction(id);
        if (res.success) {
          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        } else {
          alert(res.error || "Failed to delete invoice.");
        }
      } catch (err: any) {
        alert(err.message || "Failed to delete invoice.");
      }
    }
  };

  const handleExportCsv = () => {
    const headers = ["Type", "Doc No", "Client", "Date", "Due Date", "Subtotal", "Discount", "Grand Total", "Amount Paid", "Balance Due", "Status"];
    const rows = filteredInvoices.map((inv) => [
      inv.type,
      inv.invoiceNo,
      inv.clientSnapshot.name,
      inv.invoiceDate,
      inv.dueDate || "",
      inv.subtotal.toString(),
      inv.totalDiscount.toString(),
      inv.grandTotal.toString(),
      inv.amountPaid.toString(),
      inv.balanceDue.toString(),
      inv.status,
    ]);
    exportToCsv("invoices_ledger.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
            <span className="sm:hidden">Invoices</span>
            <span className="hidden sm:inline">Invoices &amp; Quotes</span>
          </h1>
          <p className="hidden sm:block text-sm text-slate-500 mt-1">Browse, edit, and export your billing history.</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs shrink-0"
            title="Download Invoice Ledger CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <Link
            href="/invoices/new?type=quote"
            className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-150 active:scale-95 text-sm shrink-0"
            title="New Quote"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">New Quote</span>
          </Link>

          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New Invoice</span>
          </Link>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus-within:border-indigo-500 transition-colors">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by invoice number or client name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="sm:hidden w-full flex items-center justify-between text-xs font-bold text-slate-600 py-1"
        >
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-indigo-600 text-white text-[9px]">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
        </button>

        <div className={cn(filtersOpen ? "grid" : "hidden", "sm:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 pt-2")}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">Quotes + Invoices</option>
              <option value="quote">Quotes Only</option>
              <option value="invoice">Invoices Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent / Pending</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="amount_desc">Amount (High to Low)</option>
              <option value="amount_asc">Amount (Low to High)</option>
              <option value="invoice_no">Invoice Number</option>
            </select>
          </div>
        </div>

        {(selectedType !== "all" || selectedStatus !== "all" || selectedClientId !== "all" || startDate || endDate || searchQuery) && (
          <div className="flex justify-end pt-2 border-t border-slate-50">
            <button onClick={clearFilters} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {paginatedInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <FileSpreadsheet className="h-12 w-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">No invoices matched filters</p>
          <p className="text-xs mt-1">Try resetting the filters or create a new invoice.</p>
        </div>
      ) : (
        <>
          <div className="hidden xl:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5">Doc No.</th>
                    <th className="py-3.5 px-5">Client</th>
                    <th className="py-3.5 px-5">Date</th>
                    <th className="py-3.5 px-5">Due Date</th>
                    <th className="py-3.5 px-5 text-right">Total</th>
                    <th className="py-3.5 px-5 text-right">Balance Due</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{inv.invoiceNo}</div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase mt-0.5",
                            inv.type === "quote" ? "text-amber-600" : "text-emerald-600"
                          )}
                        >
                          {inv.type === "quote" ? "Quote" : "Invoice"}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-medium text-slate-800">{inv.clientSnapshot.name}</td>
                      <td className="py-4 px-5">{formatDate(inv.invoiceDate)}</td>
                      <td className="py-4 px-5 text-slate-500">{inv.dueDate ? formatDate(inv.dueDate) : "-"}</td>
                      <td className="py-4 px-5 text-right font-black text-slate-900">
                        {formatCurrency(inv.grandTotal, inv.currency || profile.currency)}
                      </td>
                      <td className="py-4 px-5 text-right font-semibold">
                        {inv.type === "invoice" ? (
                          <span className={inv.balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}>
                            {formatCurrency(Math.max(inv.balanceDue, 0), inv.currency || profile.currency)}
                          </span>
                        ) : (
                          <span className="text-slate-350">-</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                            STATUS_STYLES[inv.status]
                          )}
                        >
                          {inv.status === "paid" && <CheckCircle2 className="h-3 w-3" />}
                          {inv.status === "sent" && <Clock className="h-3 w-3" />}
                          {inv.status === "overdue" && <AlertCircle className="h-3 w-3" />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-block"
                          >
                            Manage
                          </Link>
                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedInvoices.map((inv) => (
              <div key={inv.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 relative">
                <div className="flex items-center justify-between pr-8">
                  <div>
                    <span className="font-black text-slate-900">{inv.invoiceNo}</span>
                    <span className={cn("block text-[9px] font-bold uppercase mt-0.5", inv.type === "quote" ? "text-amber-600" : "text-emerald-600")}>
                      {inv.type === "quote" ? "Quote" : "Invoice"}
                    </span>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_STYLES[inv.status])}>
                    {inv.status}
                  </span>
                </div>

                <button
                  onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                  className="absolute top-4 right-4 p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  title="Delete Invoice"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="font-bold text-slate-800 leading-snug">{inv.clientSnapshot.name}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Date: <span className="font-medium text-slate-700">{formatDate(inv.invoiceDate)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-400">
                    Due: <span className="font-medium text-slate-700">{inv.dueDate ? formatDate(inv.dueDate) : "-"}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Billed</div>
                    <div className="font-black text-slate-950 text-lg leading-none mt-1">
                      {formatCurrency(inv.grandTotal, inv.currency || profile.currency)}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="w-full text-center text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 py-2.5 rounded-xl transition-all border border-slate-100 block"
                  >
                    Manage Invoice
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3.5 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-600 font-medium">
              <div>
                Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{" "}
                <span className="font-bold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> of{" "}
                <span className="font-bold text-slate-900">{totalItems}</span> invoices
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center px-3 font-semibold text-slate-800">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
