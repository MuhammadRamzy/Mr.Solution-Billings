import React from "react";
import Link from "next/link";
import { Plus, TrendingUp, IndianRupee, TrendingDown, Wallet } from "lucide-react";
import { getInvoices, getClients, getExpenses, getBusinessProfile } from "@/lib/db";
import { formatCurrency, cn } from "@/lib/utils";
import DashboardTabs from "@/components/DashboardTabs";

export const revalidate = 0;

export default async function DashboardPage() {
  const [allDocs, clients, expenses, profile] = await Promise.all([
    getInvoices(),
    getClients(),
    getExpenses(),
    getBusinessProfile(),
  ]);
  const currency = profile.currency;

  // Quotes never count toward revenue/tax/outstanding - only real invoices do.
  const invoices = allDocs.filter((d) => d.type === "invoice");
  const quotes = allDocs.filter((d) => d.type === "quote");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalOutstanding = 0;
  let totalBilledThisMonth = 0;
  let totalExpensesThisMonth = 0;
  let totalTaxCollected = 0;
  let totalTaxPaidOnExpenses = 0;

  const monthlyRevenueMap: Record<string, number> = {};
  const monthlyExpensesMap: Record<string, number> = {};
  const clientRevenueMap: Record<string, { name: string; total: number; count: number }> = {};
  const statusBreakdown: Record<string, { count: number; total: number }> = {
    draft: { count: 0, total: 0 },
    sent: { count: 0, total: 0 },
    partial: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    overdue: { count: 0, total: 0 },
  };

  for (const inv of invoices) {
    const invDate = new Date(inv.invoiceDate);

    if (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") {
      totalOutstanding += inv.balanceDue;
    }

    if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
      totalBilledThisMonth += inv.grandTotal;
    }

    statusBreakdown[inv.status].count += 1;
    statusBreakdown[inv.status].total += inv.grandTotal;

    if (inv.status !== "draft") {
      totalTaxCollected += inv.taxTotal;

      const monthKey = inv.invoiceDate.substring(0, 7);
      monthlyRevenueMap[monthKey] = (monthlyRevenueMap[monthKey] || 0) + inv.grandTotal;

      const cId = inv.clientId;
      if (!clientRevenueMap[cId]) {
        clientRevenueMap[cId] = { name: inv.clientSnapshot.name, total: 0, count: 0 };
      }
      clientRevenueMap[cId].total += inv.grandTotal;
      clientRevenueMap[cId].count += 1;
    }
  }

  const quotesPending = quotes.filter((q) => q.status === "sent");
  const quotesPendingValue = quotesPending.reduce((acc, q) => acc + q.grandTotal, 0);

  const expenseCategoriesMap: Record<string, number> = {};
  for (const exp of expenses) {
    const expDate = new Date(exp.date);
    if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
      totalExpensesThisMonth += exp.amount;
    }
    totalTaxPaidOnExpenses += exp.taxAmount || 0;

    const monthKey = exp.date.substring(0, 7);
    monthlyExpensesMap[monthKey] = (monthlyExpensesMap[monthKey] || 0) + exp.amount;

    expenseCategoriesMap[exp.category] = (expenseCategoriesMap[exp.category] || 0) + exp.amount;
  }

  const netProfitThisMonth = totalBilledThisMonth - totalExpensesThisMonth;

  const thisMonthStr = String(currentMonth + 1).padStart(2, "0");
  const thisMonthKey = `${currentYear}-${thisMonthStr}`;
  const lastMonthDate = new Date();
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const thisMonthRevenue = monthlyRevenueMap[thisMonthKey] || 0;
  const lastMonthRevenue = monthlyRevenueMap[lastMonthKey] || 0;
  const revenueMoM = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;

  const thisMonthExpenses = monthlyExpensesMap[thisMonthKey] || 0;
  const lastMonthExpenses = monthlyExpensesMap[lastMonthKey] || 0;
  const expensesMoM = lastMonthExpenses === 0 ? (thisMonthExpenses > 0 ? 100 : 0) : ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;

  const monthlyData: { label: string; revenue: number; expenses: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${monthNum}`;
    const label = `${monthNames[d.getMonth()]} ${String(year).slice(-2)}`;

    monthlyData.push({
      label,
      revenue: monthlyRevenueMap[key] || 0,
      expenses: monthlyExpensesMap[key] || 0,
    });
  }

  const maxVal = Math.max(...monthlyData.map((d) => Math.max(d.revenue, d.expenses)), 1000);

  const topClients = Object.values(clientRevenueMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxClientRevenue = topClients[0]?.total || 1;

  const totalRevenue = invoices.filter((i) => i.status !== "draft").reduce((acc, curr) => acc + curr.grandTotal, 0);
  const totalExpensesAllTime = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfit = totalRevenue - totalExpensesAllTime;
  const profitMarginPercent = totalRevenue === 0 ? 0 : (netProfit / totalRevenue) * 100;

  const totalExpenseSum = Object.values(expenseCategoriesMap).reduce((a, b) => a + b, 0);
  const expenseCategoriesBreakdown = Object.entries(expenseCategoriesMap)
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percent: totalExpenseSum === 0 ? 0 : (amt / totalExpenseSum) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Revenue, expenses, and profitability at a glance.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs self-start sm:self-auto animate-fade-in"
        >
          <Plus className="h-4.5 w-4.5" />
          New Invoice
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Billed This Month</span>
            <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg text-indigo-650 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalBilledThisMonth, currency)}
            </h3>
            <p className={cn("text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5", revenueMoM >= 0 ? "text-emerald-600" : "text-rose-500")}>
              {revenueMoM >= 0 ? "+" : ""}
              {revenueMoM.toFixed(1)}% MoM
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Outstanding</span>
            <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalOutstanding, currency)}
            </h3>
            <p className="text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5 text-slate-400">
              {statusBreakdown.sent.count + statusBreakdown.partial.count + statusBreakdown.overdue.count} unpaid invoices
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Expenses</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 rounded-lg text-rose-600 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalExpensesThisMonth, currency)}
            </h3>
            <p className={cn("text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5", expensesMoM <= 0 ? "text-emerald-600" : "text-rose-500")}>
              {expensesMoM >= 0 ? "+" : ""}
              {expensesMoM.toFixed(1)}% MoM
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Net Profit (Month)</span>
            <div
              className={cn(
                "p-1.5 sm:p-2 rounded-lg group-hover:scale-110 transition-transform shrink-0",
                netProfitThisMonth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}
            >
              <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(Math.abs(netProfitThisMonth), currency)}
            </h3>
            <p className={cn("text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5", netProfitThisMonth >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {netProfitThisMonth >= 0 ? "Profit" : "Loss"} this month
            </p>
          </div>
        </div>
      </div>

      <DashboardTabs
        currency={currency}
        monthlyData={monthlyData}
        maxVal={maxVal}
        statusBreakdown={statusBreakdown}
        totalTaxCollected={totalTaxCollected}
        totalTaxPaidOnExpenses={totalTaxPaidOnExpenses}
        totalRevenue={totalRevenue}
        totalExpensesAllTime={totalExpensesAllTime}
        netProfit={netProfit}
        profitMarginPercent={profitMarginPercent}
        expenseCategoriesBreakdown={expenseCategoriesBreakdown}
        topClients={topClients}
        maxClientRevenue={maxClientRevenue}
        recentInvoices={invoices.slice(0, 5)}
        recentExpenses={expenses.slice(0, 5)}
        quotesPendingCount={quotesPending.length}
        quotesPendingValue={quotesPendingValue}
      />
    </div>
  );
}
