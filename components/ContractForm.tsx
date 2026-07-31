"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, ArrowLeft, Briefcase } from "lucide-react";
import { Client, Contractor, Contract } from "@/lib/types";
import { createContractAction, updateContractAction } from "@/app/contractActions";
import { formatCurrency, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";

interface ContractFormProps {
  clients: Client[];
  contractors: Contractor[];
  contract?: Contract | null;
  preselectedClientId?: string;
}

interface FormAssignment {
  id: string;
  contractorId: string;
  role: string;
  allocatedAmount: number;
}

interface FormMilestone {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: Contract["milestones"][number]["status"];
  notes: string;
}

export default function ContractForm({ clients, contractors, contract, preselectedClientId }: ContractFormProps) {
  const router = useRouter();
  const isEditMode = !!contract;

  const [projectName, setProjectName] = useState(contract?.projectName || "");
  const [clientId, setClientId] = useState(contract?.clientId || preselectedClientId || "");
  const [contractType, setContractType] = useState<Contract["contractType"]>(contract?.contractType || "fixed");
  const [priority, setPriority] = useState<Contract["priority"]>(contract?.priority || "medium");
  const [startDate, setStartDate] = useState(contract?.startDate?.split("T")[0] || "");
  const [expectedCompletion, setExpectedCompletion] = useState(contract?.expectedCompletion?.split("T")[0] || "");
  const [contractValue, setContractValue] = useState(String(contract?.contractValue ?? 0));
  const [repositoryLink, setRepositoryLink] = useState(contract?.repositoryLink || "");
  const [deploymentUrl, setDeploymentUrl] = useState(contract?.deploymentUrl || "");
  const [figmaLink, setFigmaLink] = useState(contract?.figmaLink || "");
  const [notes, setNotes] = useState(contract?.notes || "");
  const [clientNotes, setClientNotes] = useState(contract?.clientNotes || "");

  const [assignments, setAssignments] = useState<FormAssignment[]>(
    contract?.assignments.map((a, idx) => ({ id: String(idx), contractorId: a.contractorId, role: a.role, allocatedAmount: a.allocatedAmount })) || []
  );
  const [milestones, setMilestones] = useState<FormMilestone[]>(
    contract?.milestones.map((m) => ({ id: m.id, title: m.title, amount: m.amount, dueDate: m.dueDate?.split("T")[0] || "", status: m.status, notes: m.notes || "" })) || []
  );

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addAssignment = () => {
    setAssignments([...assignments, { id: "a_" + Math.random().toString(36).slice(2, 9), contractorId: "", role: "", allocatedAmount: 0 }]);
  };
  const updateAssignment = (id: string, fields: Partial<FormAssignment>) => {
    setAssignments(assignments.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  };
  const removeAssignment = (id: string) => setAssignments(assignments.filter((a) => a.id !== id));

  const addMilestone = () => {
    setMilestones([...milestones, { id: "m_" + Math.random().toString(36).slice(2, 9), title: "", amount: 0, dueDate: "", status: "pending", notes: "" }]);
  };
  const updateMilestone = (id: string, fields: Partial<FormMilestone>) => {
    setMilestones(milestones.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  };
  const removeMilestone = (id: string) => setMilestones(milestones.filter((m) => m.id !== id));

  const budget = calculateContractBudget({
    contractValue: Number(contractValue) || 0,
    assignments: assignments.filter((a) => a.contractorId).map((a) => ({ contractorId: a.contractorId, contractorName: "", role: a.role, allocatedAmount: a.allocatedAmount })),
    contractorPayments: contract?.contractorPayments || [],
  });

  const handleSave = async () => {
    if (!projectName.trim()) {
      setErrors({ projectName: "Project name is required" });
      return;
    }
    if (!clientId) {
      setErrors({ clientId: "Please select a client" });
      return;
    }
    const validAssignments = assignments.filter((a) => a.contractorId && a.role.trim());
    for (const a of validAssignments) {
      const contractor = contractors.find((c) => c.id === a.contractorId);
      if (!contractor) continue;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      projectName,
      clientId,
      contractType,
      priority,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      expectedCompletion: expectedCompletion ? new Date(expectedCompletion).toISOString() : null,
      contractValue: Number(contractValue) || 0,
      assignments: validAssignments.map((a) => ({
        contractorId: a.contractorId,
        contractorName: contractors.find((c) => c.id === a.contractorId)?.name || "",
        role: a.role,
        allocatedAmount: Number(a.allocatedAmount) || 0,
      })),
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m) => ({
          title: m.title,
          amount: Number(m.amount) || 0,
          dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
          status: m.status,
          notes: m.notes || null,
        })),
      repositoryLink: repositoryLink || null,
      deploymentUrl: deploymentUrl || null,
      figmaLink: figmaLink || null,
      notes: notes || null,
      clientNotes: clientNotes || null,
    };

    try {
      const result = isEditMode && contract ? await updateContractAction(contract.id, payload) : await createContractAction(payload);
      if (result.success) {
        router.push(`/contracts/${result.contract.id}`);
      } else {
        setErrors({ general: result.error });
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Failed to save contract" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-5">
        <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            {isEditMode ? `Edit Contract - ${contract.contractNo}` : "New Contract"}
          </h1>
        </div>
      </div>

      {errors.general && <div className="p-4 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl">{errors.general}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Project Details</h2>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Project Name *</label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 focus:border-indigo-500 focus:outline-none",
                  errors.projectName ? "border-rose-400" : "border-slate-200"
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none",
                    errors.clientId ? "border-rose-400" : "border-slate-200"
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
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contract Value (INR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as Contract["contractType"])}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="milestone">Milestone</option>
                  <option value="hourly">Hourly</option>
                  <option value="retainer">Retainer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Contract["priority"])}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Completion</label>
                <input
                  type="date"
                  value={expectedCompletion}
                  onChange={(e) => setExpectedCompletion(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Repository Link</label>
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={repositoryLink}
                  onChange={(e) => setRepositoryLink(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deployment URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Figma Link</label>
                <input
                  type="text"
                  placeholder="https://figma.com/..."
                  value={figmaLink}
                  onChange={(e) => setFigmaLink(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-base font-bold text-slate-800">Team Assignment</h2>
              <button
                type="button"
                onClick={addAssignment}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Assign Contractor
              </button>
            </div>

            {assignments.length === 0 && <p className="text-xs text-slate-400 italic">No contractors assigned yet.</p>}

            {assignments.map((a) => (
              <div key={a.id} className="grid grid-cols-1 xl:grid-cols-[2fr_2fr_1fr_auto] gap-3 items-end p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contractor</label>
                  <select
                    value={a.contractorId}
                    onChange={(e) => updateAssignment(a.id, { contractorId: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose --</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role on This Contract</label>
                  <input
                    type="text"
                    placeholder="e.g. Backend Developer"
                    value={a.role}
                    onChange={(e) => updateAssignment(a.id, { role: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Allocated (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={a.allocatedAmount}
                    onChange={(e) => updateAssignment(a.id, { allocatedAmount: Number(e.target.value) || 0 })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <button type="button" onClick={() => removeAssignment(a.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-base font-bold text-slate-800">Milestones</h2>
              <button
                type="button"
                onClick={addMilestone}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Milestone
              </button>
            </div>

            {milestones.length === 0 && <p className="text-xs text-slate-400 italic">No milestones yet.</p>}

            {milestones.map((m) => (
              <div key={m.id} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr_minmax(112px,1.3fr)_auto] gap-3 items-end p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. UI Design"
                    value={m.title}
                    onChange={(e) => updateMilestone(m.id, { title: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.amount}
                    onChange={(e) => updateMilestone(m.id, { amount: Number(e.target.value) || 0 })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                  <input
                    type="date"
                    value={m.dueDate}
                    onChange={(e) => updateMilestone(m.id, { dueDate: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={m.status}
                    onChange={(e) => updateMilestone(m.id, { status: e.target.value as FormMilestone["status"] })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeMilestone(m.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Notes</h2>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Internal Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Client-Visible Notes</label>
              <textarea rows={2} value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-5 lg:sticky lg:top-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3">Budget Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex flex-col gap-0.5 text-slate-400">
                <span>Contract Value:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(Number(contractValue) || 0, "INR")}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-slate-400">
                <span>Allocated to Team:</span>
                <span className="font-semibold text-rose-400">-{formatCurrency(budget.totalAllocated, "INR")}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-4 mt-2">
                <span className="text-base font-bold text-slate-200">Estimated Profit:</span>
                <span className={cn("text-2xl font-black tracking-tight", budget.estimatedProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatCurrency(budget.estimatedProfit, "INR")}
                </span>
              </div>
              <div className="text-xs text-slate-500">{budget.profitMarginPercent.toFixed(1)}% margin</div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isEditMode ? "Save Changes" : "Create Contract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
