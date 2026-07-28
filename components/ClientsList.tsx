"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, Edit, Trash2, Mail, Phone, Building2, Info } from "lucide-react";
import { Client } from "@/lib/types";
import { deleteClientAction } from "@/app/actions";
import ClientDialog from "./ClientDialog";

interface ClientsListProps {
  initialClients: Client[];
}

export default function ClientsList({ initialClients }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, client: Client) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleClientSaved = (client: Client) => {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id);
      if (idx === -1) return [client, ...prev];
      const next = [...prev];
      next[idx] = client;
      return next;
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete client "${name}"? This will not delete their existing invoices.`)) {
      try {
        const res = await deleteClientAction(id);
        if (res.success) {
          setClients((prev) => prev.filter((c) => c.id !== id));
        } else {
          alert(res.error || "Failed to delete client.");
        }
      } catch (err: any) {
        alert(err.message || "Failed to delete client.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600 shrink-0" />
            Clients
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage the people and companies you bill.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </div>

      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus-within:border-indigo-500 transition-colors">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, company, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Info className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-500">No clients found</p>
          <p className="text-xs mt-1">Add your first client to start invoicing them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all space-y-3 relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{client.name}</h3>
                  {client.companyName && (
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {client.companyName}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleOpenEditModal(e, client)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Edit Client"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, client.id, client.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    title="Delete Client"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-500">
                {client.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {client.phone}
                  </div>
                )}
                {!client.email && !client.phone && <div className="italic text-slate-300">No contact details</div>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ClientDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={editingClient}
        onSuccess={handleClientSaved}
      />
    </div>
  );
}
