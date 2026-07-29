"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  BarChart3,
  PieChart,
  Percent,
  Receipt,
  Activity,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Invoice, Expense } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CATEGORIES } from "./ExpensesList";

interface MonthlyDataPoint {
  label: string;
  revenue: number;
  expenses: number;
}

interface StatusBucket {
  count: number;
  total: number;
}

interface DashboardTabsProps {
  currency: string;
  monthlyData: MonthlyDataPoint[];
  maxVal: number;
  statusBreakdown: Record<string, StatusBucket>;
  totalTaxPaidOnExpenses: number;

  totalRevenue: number;
  totalExpensesAllTime: number;
  netProfit: number;
  profitMarginPercent: number;
  expenseCategoriesBreakdown: { category: string; amount: number; percent: number }[];

  topClients: { name: string; total: number; count: number }[];
  maxClientRevenue: number;
  recentInvoices: Invoice[];
  recentExpenses: Expense[];
  quotesPendingCount: number;
  quotesPendingValue: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-400",
  sent: "bg-amber-400",
  partial: "bg-sky-400",
  paid: "bg-emerald-500",
  overdue: "bg-rose-500",
};

export default function DashboardTabs({
  currency,
  monthlyData,
  maxVal,
  statusBreakdown,
  totalTaxPaidOnExpenses,
  totalRevenue,
  totalExpensesAllTime,
  netProfit,
  profitMarginPercent,
  expenseCategoriesBreakdown,
  topClients,
  maxClientRevenue,
  recentInvoices,
  recentExpenses,
  quotesPendingCount,
  quotesPendingValue,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "profitability" | "leaderboards" | "recent">("overview");
  const [activeActivityTab, setActiveActivityTab] = useState<"invoices" | "expenses">("invoices");

  const totalInvoiceCount = Object.values(statusBreakdown).reduce((acc, s) => acc + s.count, 0);

  const renderTrendChart = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Revenue vs Expenses
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Last 6 months, billed revenue vs recorded expenses.</p>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-extrabold uppercase">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-indigo-600" /> Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-rose-500" /> Expenses
          </span>
        </div>
      </div>

      <div className="relative pt-6 w-full h-[220px] flex items-end">
        <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-between pointer-events-none border-b border-slate-100 pb-8 pt-4">
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
        </div>

        <div className="relative z-10 w-full h-full flex items-end justify-between px-1 sm:px-6">
          {monthlyData.map((m, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 bg-slate-950 text-white text-[10px] font-bold p-2.5 rounded-xl absolute -translate-y-16 shadow-lg z-25 pointer-events-none w-36 text-center space-y-1">
                <div className="text-[9px] text-slate-400 font-semibold">{m.label}</div>
                <div className="flex justify-between text-indigo-400">
                  <span>Revenue:</span> <span>{formatCurrency(m.revenue, currency)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Expenses:</span> <span>{formatCurrency(m.expenses, currency)}</span>
                </div>
              </div>

              <div className="flex items-end justify-center gap-1 sm:gap-2 h-[140px] sm:h-[160px] w-full">
                <div
                  style={{ height: `${m.revenue > 0 ? Math.max((m.revenue / maxVal) * 80, 4) : 2}%` }}
                  className="w-2 sm:w-4 bg-gradient-to-t from-indigo-650 to-indigo-500 rounded-t-sm shadow-sm transition-all duration-300"
                />
                <div
                  style={{ height: `${m.expenses > 0 ? Math.max((m.expenses / maxVal) * 80, 4) : 2}%` }}
                  className="w-2 sm:w-4 bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-sm shadow-sm transition-all duration-300"
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-2 tracking-tight">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStatusSummary = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <PieChart className="h-5 w-5 text-indigo-600" />
        Invoice Status Breakdown
      </h2>

      <div className="space-y-4 pt-2">
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
          {(["paid", "partial", "sent", "overdue", "draft"] as const).map((status) => {
            const bucket = statusBreakdown[status];
            const pct = totalInvoiceCount > 0 ? (bucket.count / totalInvoiceCount) * 100 : 0;
            return pct > 0 ? (
              <div key={status} style={{ width: `${pct}%` }} className={cn("h-full", STATUS_COLORS[status])} title={`${status}: ${bucket.count}`} />
            ) : null;
          })}
        </div>

        <div className="space-y-2.5">
          {(["paid", "partial", "sent", "overdue", "draft"] as const).map((status) => {
            const bucket = statusBreakdown[status];
            return (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-600 capitalize">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
                  {status === "partial" ? "Partially Paid" : status}
                  <span className="text-slate-400">({bucket.count})</span>
                </span>
                <span className="font-bold text-slate-900">{formatCurrency(bucket.total, currency)}</span>
              </div>
            );
          })}
        </div>

        {quotesPendingCount > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
              <FileText className="h-3.5 w-3.5" />
              {quotesPendingCount} quote{quotesPendingCount > 1 ? "s" : ""} awaiting response
            </span>
            <span className="text-xs font-black text-amber-800">{formatCurrency(quotesPendingValue, currency)}</span>
          </div>
        )}

        {totalTaxPaidOnExpenses > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between mt-2">
            <span className="text-[11px] font-semibold text-slate-500">Tax Paid on Expenses (for your records):</span>
            <span className="text-[11px] font-bold text-slate-800">{formatCurrency(totalTaxPaidOnExpenses, currency)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderProfitability = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Percent className="h-5 w-5 text-indigo-650" />
          Profitability (All-Time)
        </h2>
        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Revenue from non-draft invoices minus all recorded expenses.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Revenue</div>
          <div className="text-lg font-black text-slate-900">{formatCurrency(totalRevenue, currency)}</div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Net Profit</div>
          <div className={cn("text-lg font-black", netProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {formatCurrency(netProfit, currency)}
          </div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Profit Margin</div>
          <div className={cn("text-lg font-black", profitMarginPercent >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {profitMarginPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Expense Breakdown by Category</h3>
        {expenseCategoriesBreakdown.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No expenses recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {expenseCategoriesBreakdown.map((cat, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl space-y-2 transition-all">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">{CATEGORIES.find((c) => c.value === cat.category)?.label || cat.category}</span>
                  <span className="font-extrabold text-slate-900 font-mono">{formatCurrency(cat.amount, currency)}</span>
                </div>
                <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                  <div style={{ width: `${cat.percent}%` }} className="bg-rose-500 h-full rounded-full" />
                </div>
                <div className="text-[9px] text-slate-400 font-semibold text-right">{cat.percent.toFixed(1)}% of total expenses</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTopClients = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-650" />
        Top Clients by Revenue
      </h2>

      {topClients.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No client revenue data available yet.</p>
      ) : (
        <div className="space-y-4">
          {topClients.map((c, idx) => {
            const percent = (c.total / maxClientRevenue) * 100;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800 truncate max-w-[200px] sm:max-w-xs">{c.name}</span>
                  <span className="text-slate-900 font-bold font-mono">{formatCurrency(c.total, currency)}</span>
                </div>
                <div className="h-2 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                  <div style={{ width: `${percent}%` }} className="bg-gradient-to-r from-indigo-500 to-indigo-650 h-full rounded-full" />
                </div>
                <div className="text-[10px] text-slate-400">
                  Billed <span className="font-bold text-slate-600">{c.count}</span> times
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderActivityLogs = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          Recent Activity
        </h2>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveActivityTab("invoices")}
            className={cn(
              "px-3 py-1 rounded text-[10px] font-bold transition-all",
              activeActivityTab === "invoices" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-850"
            )}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveActivityTab("expenses")}
            className={cn(
              "px-3 py-1 rounded text-[10px] font-bold transition-all",
              activeActivityTab === "expenses" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-850"
            )}
          >
            Expenses
          </button>
        </div>
      </div>

      <div className="px-5 pb-5">
        {activeActivityTab === "invoices" && (
          <div className="divide-y divide-slate-100">
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No recent invoices.</p>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <Link href={`/invoices/${inv.id}`} className="font-bold text-slate-900 hover:underline">
                      {inv.invoiceNo}
                    </Link>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {inv.clientSnapshot.name} &bull; {formatDate(inv.invoiceDate)}
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">{formatCurrency(inv.grandTotal, inv.currency || currency)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeActivityTab === "expenses" && (
          <div className="divide-y divide-slate-100">
            {recentExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No recent expenses.</p>
            ) : (
              recentExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-950">{exp.description}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {CATEGORIES.find((c) => c.value === exp.category)?.label} &bull; {formatDate(exp.date)}
                    </div>
                  </div>
                  <span className="font-extrabold text-rose-600">{formatCurrency(exp.amount, currency)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "overview" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab("profitability")}
          className={cn(
            "flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "profitability" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Percent className="h-4 w-4" />
          Profitability
        </button>

        <button
          onClick={() => setActiveTab("leaderboards")}
          className={cn(
            "flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "leaderboards" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="h-4 w-4" />
          Clients
        </button>

        <button
          onClick={() => setActiveTab("recent")}
          className={cn(
            "flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "recent" ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Activity className="h-4 w-4" />
          Activity Log
        </button>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">{renderTrendChart()}</div>
              <div>{renderStatusSummary()}</div>
            </div>
            <div>{renderTopClients()}</div>
          </>
        )}

        {activeTab === "profitability" && renderProfitability()}

        {activeTab === "leaderboards" && renderTopClients()}

        {activeTab === "recent" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderActivityLogs()}
            <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl flex flex-col justify-between items-center text-center text-slate-500">
              <div className="space-y-2 mt-4">
                <Receipt className="h-10 w-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-900 text-sm">Printable Ledger Reports</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  View and export all transactions directly. Press <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Alt + Shift + 1-5</kbd> to quick-navigate.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-8">
                <Link href="/invoices" className="flex-1 py-2 px-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl active:scale-95 transition-all">
                  Invoices
                </Link>
                <Link href="/expenses" className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all">
                  Expenses
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
