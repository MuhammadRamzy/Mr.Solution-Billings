"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { Contractor } from "@/lib/types";
import { createContractorAction, updateContractorAction } from "@/app/contractActions";
import { Loader2 } from "lucide-react";

interface ContractorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (contractor: Contractor) => void;
  contractor?: Contractor | null;
}

const PAYMENT_METHODS: { value: Contractor["preferredPaymentMethod"]; label: string }[] = [
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

export default function ContractorDialog({ isOpen, onClose, onSuccess, contractor }: ContractorDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [primaryRole, setPrimaryRole] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [sprintRate, setSprintRate] = useState("0");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<Contractor["preferredPaymentMethod"]>("bank");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscOrSwift, setIfscOrSwift] = useState("");
  const [branch, setBranch] = useState("");
  const [upiId, setUpiId] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [status, setStatus] = useState<Contractor["status"]>("active");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contractor) {
      setName(contractor.name);
      setEmail(contractor.email || "");
      setPhone(contractor.phone || "");
      setCollege(contractor.college || "");
      setSkillsInput(contractor.skills.join(", "));
      setPrimaryRole(contractor.primaryRole || "");
      setHourlyRate(String(contractor.hourlyRate));
      setSprintRate(String(contractor.sprintRate));
      setPreferredPaymentMethod(contractor.preferredPaymentMethod);
      setBankName(contractor.bank.bankName || "");
      setAccountName(contractor.bank.accountName || "");
      setAccountNo(contractor.bank.accountNo || "");
      setIfscOrSwift(contractor.bank.ifscOrSwift || "");
      setBranch(contractor.bank.branch || "");
      setUpiId(contractor.upiId || "");
      setPanNumber(contractor.panNumber || "");
      setStatus(contractor.status);
      setNotes(contractor.notes || "");
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setCollege("");
      setSkillsInput("");
      setPrimaryRole("");
      setHourlyRate("0");
      setSprintRate("0");
      setPreferredPaymentMethod("bank");
      setBankName("");
      setAccountName("");
      setAccountNo("");
      setIfscOrSwift("");
      setBranch("");
      setUpiId("");
      setPanNumber("");
      setStatus("active");
      setNotes("");
    }
    setErrors({});
  }, [contractor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = {
      name,
      email: email || null,
      phone: phone || null,
      college: college || null,
      skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
      primaryRole: primaryRole || null,
      hourlyRate: Number(hourlyRate) || 0,
      sprintRate: Number(sprintRate) || 0,
      preferredPaymentMethod,
      bank: { bankName, accountName, accountNo, ifscOrSwift, branch },
      upiId: upiId || null,
      panNumber: panNumber || null,
      status,
      notes: notes || null,
    };

    try {
      const result = contractor
        ? await updateContractorAction(contractor.id, payload)
        : await createContractorAction(payload);

      if (result.success) {
        if (onSuccess) onSuccess(result.contractor);
        onClose();
      } else {
        setErrors({ general: result.error });
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={contractor ? "Edit Contractor" : "Add New Contractor"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{errors.general}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Arjun Nair"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Role</label>
            <input
              type="text"
              placeholder="e.g. Backend Developer"
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">College (Optional)</label>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Contractor["status"])}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="busy">Busy</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Skills (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. React, Node.js, Figma"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hourly Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sprint Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sprintRate}
              onChange={(e) => setSprintRate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pay Via</label>
            <select
              value={preferredPaymentMethod}
              onChange={(e) => setPreferredPaymentMethod(e.target.value as Contractor["preferredPaymentMethod"])}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Holder</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Number</label>
            <input
              type="text"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IFSC / SWIFT</label>
            <input
              type="text"
              value={ifscOrSwift}
              onChange={(e) => setIfscOrSwift(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">PAN (Optional)</label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-75 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {contractor ? "Save Changes" : "Add Contractor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
