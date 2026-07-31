"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
} from "lucide-react";
import { Contract, Client, Contractor } from "@/lib/types";
import { updateContractStatusAction, deleteContractAction, recordContractorPaymentAction, deleteContractorPaymentAction } from "@/app/contractActions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";
import ContractForm from "./ContractForm";
import Modal from "./Modal";

interface ContractDetailViewProps {
  contract: Contract;
  client: Client | undefined;
  clients: Client[];
  contractors: Contractor[];
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

const STATUS_FLOW: Contract["status"][] = ["draft", "assigned", "in_progress", "delivered", "completed"];

const PAYMENT_METHODS: { value: NonNullable<Parameters<typeof recordContractorPaymentAction>[1]>["method"]; label: string }[] = [
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

export default function ContractDetailView({ contract: initialContract, client, clients, contractors }: ContractDetailViewProps) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract>(initialContract);
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    contractorId: contract.assignments[0]?.contractorId || "",
    amount: "",
    date: new Date().toISOString().substring(0, 10),
    method: "bank" as "bank" | "upi" | "cash" | "paypal" | "other" | "card",
    note: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const budget = calculateContractBudget(contract);
  const currentStatusIndex = STATUS_FLOW.indexOf(contract.status);

  const handleStatusChange = async (status: Contract["status"]) => {
    setStatusLoading(true);
    try {
      const res = await updateContractStatusAction(contract.id, status);
      if (res.success) {
        setContract((prev) => ({ ...prev, status }));
      } else {
        alert(res.error || "Failed to update status");
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete contract "${contract.contractNo}"? This cannot be undone.`)) {
      const res = await deleteContractAction(contract.id);
      if (res.success) {
        router.push("/contracts");
      } else {
        alert(res.error || "Failed to delete contract");
      }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError("");
    const amount = parseFloat(paymentForm.amount);
    if (!paymentForm.contractorId) {
      setPaymentError("Select a contractor");
      return;
    }
    if (!amount || amount <= 0) {
      setPaymentError("Enter a valid amount");
      return;
    }
    setPaymentSubmitting(true);
    try {
      const res = await recordContractorPaymentAction(contract.id, {
        contractorId: paymentForm.contractorId,
        amount,
        date: paymentForm.date,
        method: paymentForm.method,
        note: paymentForm.note || null,
      });
      if (res.success) {
        setContract(res.contract);
        setIsPaymentModalOpen(false);
        setPaymentForm({ contractorId: contract.assignments[0]?.contractorId || "", amount: "", date: new Date().toISOString().substring(0, 10), method: "bank", note: "" });
      } else {
        setPaymentError(res.error || "Failed to record payment");
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Remove this contractor payment?")) return;
    const res = await deleteContractorPaymentAction(contract.id, paymentId);
    if (res.success) {
      setContract(res.contract);
    } else {
      alert(res.error || "Failed to remove payment");
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-sm font-semibold text-slate-500">Editing Mode</span>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
        <ContractForm clients={clients} contractors={contractors} contract={contract} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/contracts")} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-mono text-sm font-bold text-slate-500">Contract</span>
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_STYLES[contract.status])}>
            {contract.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{contract.projectName}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {contract.contractNo} &bull; {contract.clientSnapshot.name}
              {contract.clientSnapshot.companyName ? ` (${contract.clientSnapshot.companyName})` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 sm:hidden">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleDelete} className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold px-3 py-2 rounded-xl text-sm transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleDelete} className="inline-flex items-center justify-center gap-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 overflow-x-auto no-scrollbar w-full sm:w-fit">
          {STATUS_FLOW.map((s, idx) => (
            <button
              key={s}
              disabled={statusLoading}
              onClick={() => handleStatusChange(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1",
                contract.status === s ? "bg-indigo-600 text-white" : idx < currentStatusIndex ? "text-emerald-600" : "text-slate-500 hover:bg-slate-100",
                statusLoading && "opacity-50"
              )}
            >
              {idx < currentStatusIndex && <CheckCircle className="h-3 w-3" />}
              {s.replace("_", " ")}
            </button>
          ))}
          <button
            disabled={statusLoading || contract.status === "paused"}
            onClick={() => handleStatusChange("paused")}
            className={cn("px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1", contract.status === "paused" ? "bg-slate-300 text-slate-800" : "text-slate-400 hover:bg-slate-100")}
          >
            <Pause className="h-3 w-3" /> Paused
          </button>
          <button
            disabled={statusLoading || contract.status === "cancelled"}
            onClick={() => handleStatusChange("cancelled")}
            className={cn("px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1", contract.status === "cancelled" ? "bg-rose-100 text-rose-700" : "text-slate-400 hover:bg-slate-100")}
          >
            <XCircle className="h-3 w-3" /> Cancelled
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" /> Team
            </h2>
            {contract.assignments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contractors assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.assignments.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{a.contractorName}</div>
                      <div className="text-xs text-slate-500">{a.role}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{formatCurrency(a.allocatedAmount, "INR")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">Milestones</h2>
            {contract.milestones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No milestones yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{m.title}</div>
                      {m.dueDate && <div className="text-xs text-slate-500">Due {formatDate(m.dueDate)}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", m.status === "paid" ? "bg-emerald-50 text-emerald-700" : m.status === "completed" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                        {m.status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{formatCurrency(m.amount, "INR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(contract.repositoryLink || contract.deploymentUrl || contract.figmaLink) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Links</h2>
              {contract.repositoryLink && (
                <a href={contract.repositoryLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Repository
                </a>
              )}
              {contract.deploymentUrl && (
                <a href={contract.deploymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Deployment
                </a>
              )}
              {contract.figmaLink && (
                <a href={contract.figmaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Figma
                </a>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Contractor Payments</h2>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Record Payment
              </button>
            </div>
            {contract.contractorPayments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contractor payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.contractorPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(p.amount, "INR")}</div>
                      <div className="text-xs text-slate-500">
                        {p.contractorName} &bull; {formatDate(p.date)} &bull; {p.method}
                      </div>
                    </div>
                    <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-4 lg:sticky lg:top-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Budget
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Contract Value:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(contract.contractValue, "INR")}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Allocated:</span>
                <span className="font-semibold text-rose-400">-{formatCurrency(budget.totalAllocated, "INR")}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-3">
                <span className="font-bold text-slate-200">Est. Profit:</span>
                <span className={cn("text-xl font-black", budget.estimatedProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatCurrency(budget.estimatedProfit, "INR")}</span>
              </div>
              <div className="text-xs text-slate-500">{budget.profitMarginPercent.toFixed(1)}% margin</div>
              <div className="border-t border-slate-800 pt-3 flex justify-between text-slate-400">
                <span>Paid to Team:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(budget.totalPaid, "INR")}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Pending Payout:</span>
                <span className="font-semibold text-amber-400">{formatCurrency(budget.totalPending, "INR")}</span>
              </div>
            </div>
          </div>

          {client && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Client</h2>
              <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {client.name}
              </Link>
              {contract.sourceQuoteId && (
                <Link href={`/invoices/${contract.sourceQuoteId}`} className="block mt-2 text-xs text-slate-500 hover:text-indigo-600">
                  View source quote &rarr;
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Contractor Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{paymentError}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contractor *</label>
            <select
              value={paymentForm.contractorId}
              onChange={(e) => setPaymentForm((f) => ({ ...f, contractorId: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose --</option>
              {contract.assignments.map((a) => (
                <option key={a.contractorId} value={a.contractorId}>
                  {a.contractorName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Method</label>
            <select
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as typeof f.method }))}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={paymentSubmitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-75 transition-colors">
              Record Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
