"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { Client } from "@/lib/types";
import { createClientAction, updateClientAction } from "@/app/actions";
import { Loader2 } from "lucide-react";

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (client: Client) => void;
  client?: Client | null;
}

export default function ClientDialog({ isOpen, onClose, onSuccess, client }: ClientDialogProps) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      setName(client.name || "");
      setCompanyName(client.companyName || "");
      setAddress(client.address || "");
      setCity(client.city || "");
      setState(client.state || "");
      setPincode(client.pincode || "");
      setCountry(client.country || "");
      setTaxId(client.taxId || "");
      setPhone(client.phone || "");
      setEmail(client.email || "");
      setNotes(client.notes || "");
    } else {
      setName("");
      setCompanyName("");
      setAddress("");
      setCity("");
      setState("");
      setPincode("");
      setCountry("");
      setTaxId("");
      setPhone("");
      setEmail("");
      setNotes("");
    }
    setErrors({});
  }, [client, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = {
      name,
      companyName: companyName || null,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      country: country || null,
      taxId: taxId || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    };

    try {
      let result;
      if (client) {
        result = await updateClientAction(client.id, payload);
      } else {
        result = await createClientAction(payload);
      }

      if (result.success) {
        if (onSuccess && result.client) {
          onSuccess(result.client);
        }
        onClose();
      } else {
        setErrors({ general: result.error });
      }
    } catch (err: any) {
      if (err.name === "ZodError" || err.errors) {
        const fieldErrors: Record<string, string> = {};
        err.errors?.forEach((e: any) => {
          if (e.path && e.path.length > 0) {
            fieldErrors[e.path[0]] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: err.message || "Something went wrong" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={client ? "Edit Client" : "Add New Client"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{errors.general}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Client Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.name && <span className="text-xs text-rose-500 mt-1">{errors.name}</span>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Acme Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="Contact number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
            <input
              type="email"
              placeholder="e.g. client@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.email && <span className="text-xs text-rose-500 mt-1">{errors.email}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Billing Address</label>
          <input
            type="text"
            placeholder="Street address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pincode</label>
            <input
              type="text"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tax ID / GSTIN (Optional)</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            placeholder="Internal notes about this client..."
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
            {client ? "Save Changes" : "Add Client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
