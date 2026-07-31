"use client";

import React, { useState } from "react";
import { Plus, Search, UserCog, Edit, Trash2, Mail, Phone, Info } from "lucide-react";
import { Contractor } from "@/lib/types";
import { deleteContractorAction } from "@/app/contractActions";
import { formatCurrency } from "@/lib/utils";
import ContractorDialog from "./ContractorDialog";

interface ContractorsListProps {
  initialContractors: Contractor[];
}

const STATUS_STYLES: Record<Contractor["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  busy: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
};

export default function ContractorsList({ initialContractors }: ContractorsListProps) {
  const [contractors, setContractors] = useState<Contractor[]>(initialContractors);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);

  const filteredContractors = contractors.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.primaryRole && c.primaryRole.toLowerCase().includes(q)) ||
      c.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setEditingContractor(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setIsModalOpen(true);
  };

  const handleContractorSaved = (contractor: Contractor) => {
    setContractors((prev) => {
      const idx = prev.findIndex((c) => c.id === contractor.id);
      if (idx === -1) return [...prev, contractor].sort((a, b) => a.name.localeCompare(b.name));
      const next = [...prev];
      next[idx] = contractor;
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete contractor "${name}"? This will not delete contracts they were assigned to.`)) {
      const res = await deleteContractorAction(id);
      if (res.success) {
        setContractors((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(res.error || "Failed to delete contractor.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            Contractors
          </h1>
          <p className="hidden sm:block text-sm text-slate-500 mt-1">People who deliver work under Systemiq contracts.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add Contractor</span>
        </button>
      </div>

      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus-within:border-indigo-500 transition-colors">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, role, or skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
        />
      </div>

      {filteredContractors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Info className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-500">No contractors found</p>
          <p className="text-xs mt-1">Add the people who deliver work under Systemiq contracts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContractors.map((contractor) => (
            <div key={contractor.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{contractor.name}</h3>
                  {contractor.primaryRole && <div className="text-xs text-slate-500 truncate">{contractor.primaryRole}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[contractor.status]}`}>
                    {contractor.status}
                  </span>
                  <button
                    onClick={() => handleOpenEditModal(contractor)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Edit Contractor"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contractor.id, contractor.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    title="Delete Contractor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {contractor.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contractor.skills.map((skill) => (
                    <span key={skill} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-500">
                {contractor.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {contractor.email}
                  </div>
                )}
                {contractor.phone && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {contractor.phone}
                  </div>
                )}
                {contractor.hourlyRate > 0 && (
                  <div className="text-slate-700 font-semibold">{formatCurrency(contractor.hourlyRate, "INR")}/hr</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContractorDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contractor={editingContractor}
        onSuccess={handleContractorSaved}
      />
    </div>
  );
}
