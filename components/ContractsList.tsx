"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Briefcase } from "lucide-react";
import { Contract } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";

interface ContractsListProps {
  initialContracts: Contract[];
}

const STATUS_STYLES: Record<Contract["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-50 text-sky-700",
  in_progress: "bg-amber-50 text-amber-700",
  delivered: "bg-indigo-50 text-indigo-700",
  completed: "bg-emerald-50 text-emerald-700",
  paused: "bg-slate-200 text-slate-600",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function ContractsList({ initialContracts }: ContractsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | Contract["status"]>("all");

  const filtered = initialContracts.filter((c) => {
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
    const q = searchQuery.toLowerCase();
    return c.projectName.toLowerCase().includes(q) || c.contractNo.toLowerCase().includes(q) || c.clientSnapshot.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            Contracts
          </h1>
          <p className="hidden sm:block text-sm text-slate-500 mt-1">Delivery contracts for accepted work.</p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus-within:border-indigo-500 transition-colors">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by project, contract no., or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
          className="w-full sm:w-56 text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Briefcase className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-500">No contracts found</p>
          <p className="text-xs mt-1">Convert an accepted quote, or create a contract directly.</p>
        </div>
      ) : (
        <>
          <div className="hidden xl:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5">Contract No.</th>
                    <th className="py-3.5 px-5">Project</th>
                    <th className="py-3.5 px-5">Client</th>
                    <th className="py-3.5 px-5 text-right">Value</th>
                    <th className="py-3.5 px-5 text-right">Est. Profit</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const budget = calculateContractBudget(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-mono font-bold text-slate-900">
                          <Link href={`/contracts/${c.id}`} className="hover:text-indigo-600">
                            {c.contractNo}
                          </Link>
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-800">{c.projectName}</td>
                        <td className="py-4 px-5">{c.clientSnapshot.name}</td>
                        <td className="py-4 px-5 text-right font-semibold">{formatCurrency(c.contractValue, "INR")}</td>
                        <td className={cn("py-4 px-5 text-right font-semibold", budget.estimatedProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {formatCurrency(budget.estimatedProfit, "INR")}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider", STATUS_STYLES[c.status])}>
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const budget = calculateContractBudget(c);
              return (
                <Link key={c.id} href={`/contracts/${c.id}`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">{c.contractNo}</span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_STYLES[c.status])}>{c.status.replace("_", " ")}</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{c.projectName}</div>
                    <div className="text-xs text-slate-500">{c.clientSnapshot.name}</div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                    <span className="text-slate-400">Value: {formatCurrency(c.contractValue, "INR")}</span>
                    <span className={cn("font-bold", budget.estimatedProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(budget.estimatedProfit, "INR")}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
