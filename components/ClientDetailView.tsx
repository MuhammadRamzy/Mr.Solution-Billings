"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileSpreadsheet,
  Plus,
  Wallet,
  Clock,
} from "lucide-react";
import { Client, Invoice } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { deleteClientAction } from "@/app/actions";
import ClientDialog from "./ClientDialog";

interface ClientDetailViewProps {
  client: Client;
  invoices: Invoice[];
}

export default function ClientDetailView({ client: initialClient, invoices }: ClientDetailViewProps) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const totalBilled = invoices.filter((i) => i.status !== "draft").reduce((acc, i) => acc + i.grandTotal, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((acc, i) => acc + i.grandTotal, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((acc, i) => acc + i.grandTotal, 0);
  const currency = invoices[0]?.currency;

  const handleDelete = async () => {
    if (confirm(`Delete client "${client.name}"? This will not delete their existing invoices.`)) {
      try {
        await deleteClientAction(client.id);
        router.push("/clients");
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Failed to delete client.");
      }
    }
  };

  const addressParts = [client.address, client.city, client.state, client.pincode, client.country].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/clients")}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold text-slate-500">Client Profile</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 lg:col-span-1 h-fit">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{client.name}</h1>
              {client.companyName && (
                <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {client.companyName}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsEditOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                title="Edit Client"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                title="Delete Client"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600 pt-4 border-t border-slate-50">
            {client.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                {client.email}
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                {client.phone}
              </div>
            )}
            {addressParts.length > 0 && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{addressParts.join(", ")}</span>
              </div>
            )}
            {client.taxId && (
              <div className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg inline-block">
                Tax ID: {client.taxId}
              </div>
            )}
          </div>

          {client.notes && (
            <div className="pt-4 border-t border-slate-50">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</div>
              <p className="text-xs text-slate-600 leading-relaxed">{client.notes}</p>
            </div>
          )}

          <Link
            href={`/invoices/new?clientId=${client.id}`}
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs"
          >
            <Plus className="h-4 w-4" />
            New Invoice for {client.name.split(" ")[0]}
          </Link>
        </div>

        {/* Stats + Invoices */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Billed</div>
              <div className="text-lg font-black text-slate-900 mt-1">{formatCurrency(totalBilled, currency)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Outstanding</div>
              <div className="text-lg font-black text-amber-600 mt-1">{formatCurrency(totalOutstanding, currency)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid</div>
              <div className="text-lg font-black text-emerald-600 mt-1">{formatCurrency(totalPaid, currency)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                Invoice History
              </h2>
            </div>
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-8 text-center">No invoices for this client yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{inv.invoiceNo}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(inv.invoiceDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          inv.status === "paid" && "bg-emerald-50 text-emerald-700",
                          inv.status === "sent" && "bg-amber-50 text-amber-700",
                          inv.status === "draft" && "bg-slate-100 text-slate-700",
                          inv.status === "overdue" && "bg-rose-50 text-rose-700"
                        )}
                      >
                        {inv.status}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formatCurrency(inv.grandTotal, inv.currency)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ClientDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        client={client}
        onSuccess={(c) => setClient(c)}
      />
    </div>
  );
}
