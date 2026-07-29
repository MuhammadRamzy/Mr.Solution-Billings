"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building, CreditCard, MapPin, Save, CheckCircle, Loader2, FileText, Key, QrCode, ChevronDown } from "lucide-react";
import QRCodeLib from "qrcode";
import { BusinessProfile, BusinessProfileSchema } from "@/lib/types";
import { updateBusinessProfileAction, changePasswordAction } from "@/app/actions";
import { cn } from "@/lib/utils";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED"];

interface SettingsFormProps {
  initialProfile: BusinessProfile;
}

export default function SettingsForm({ initialProfile }: SettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<BusinessProfile>(initialProfile);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [showAdvancedQr, setShowAdvancedQr] = useState(!!initialProfile.qrCodeUrl);

  useEffect(() => {
    if (!formData.upiId) {
      setQrPreview(null);
      return;
    }
    let cancelled = false;
    const uri = `upi://pay?${new URLSearchParams({
      pa: formData.upiId,
      pn: formData.name || "Payee",
      cu: "INR",
    }).toString()}`;
    QRCodeLib.toDataURL(uri, { margin: 1, width: 160 })
      .then((url) => {
        if (!cancelled) setQrPreview(url);
      })
      .catch(() => {
        if (!cancelled) setQrPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.upiId, formData.name]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdSuccess(false);
    setPwdError(null);

    if (newPassword !== confirmPassword) {
      setPwdError("New PINs do not match");
      setPwdLoading(false);
      return;
    }
    if (!/^\d{4,6}$/.test(newPassword)) {
      setPwdError("PIN must be 4 to 6 digits");
      setPwdLoading(false);
      return;
    }

    try {
      const res = await changePasswordAction(currentPassword, newPassword);
      if (res.success) {
        setPwdSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwdError(res.error || "Failed to update password");
      }
    } catch (err: any) {
      setPwdError(err.message || "An unexpected error occurred");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChange = (path: string, value: string) => {
    setSuccess(false);
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[path];
      return updated;
    });

    if (path === "defaultPaymentDueDays" || path === "defaultQuoteValidityDays") {
      const parsedVal = parseInt(value, 10);
      setFormData((prev) => ({ ...prev, [path]: isNaN(parsedVal) ? 0 : parsedVal }));
    } else if (path.startsWith("bank.")) {
      const field = path.split(".")[1];
      setFormData((prev) => ({ ...prev, bank: { ...prev.bank, [field]: value } }));
    } else {
      setFormData((prev) => ({ ...prev, [path]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setErrors({});

    const result = BusinessProfileSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        newErrors[path] = err.message;
      });
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const res = await updateBusinessProfileAction(formData);
      if (res.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setErrors({ general: res.error });
      }
    } catch (err: any) {
      console.error(err);
      setErrors({ general: err.message || "Failed to update settings" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <form onSubmit={handleSave} className="space-y-8">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
            <p className="hidden sm:block text-sm text-slate-600 mt-1">Configure your business profile, currency, and default invoice terms.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm disabled:opacity-70 shrink-0 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
            Save Settings
          </button>
        </div>

        {success && (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2 border border-emerald-100 animate-in fade-in slide-in-from-top-1 duration-200">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>Settings saved successfully.</span>
          </div>
        )}

        {errors.general && (
          <div className="p-4 bg-rose-50 text-rose-800 text-sm font-bold rounded-xl border border-rose-100">{errors.general}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand Information */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-600" />
              Your Business Profile
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Your Name / Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g. Jordan Rivera Design"
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                    errors.name ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors.name && <span className="text-xs text-rose-500 mt-1 block">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Tagline / Role</label>
                <input
                  type="text"
                  value={formData.tagline || ""}
                  onChange={(e) => handleChange("tagline", e.target.value)}
                  placeholder="e.g. Freelance Product Designer"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Logo Image URL</label>
                <input
                  type="text"
                  value={formData.logoUrl || ""}
                  onChange={(e) => handleChange("logoUrl", e.target.value)}
                  placeholder="e.g. /logo.png"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Website</label>
                  <input
                    type="text"
                    value={formData.website || ""}
                    onChange={(e) => handleChange("website", e.target.value)}
                    placeholder="e.g. yourname.com"
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Payment / Bank Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              Payment Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank.bankName || ""}
                  onChange={(e) => handleChange("bank.bankName", e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Account Holder Name</label>
                <input
                  type="text"
                  value={formData.bank.accountName || ""}
                  onChange={(e) => handleChange("bank.accountName", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={formData.bank.accountNo || ""}
                  onChange={(e) => handleChange("bank.accountNo", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">IFSC / SWIFT</label>
                  <input
                    type="text"
                    value={formData.bank.ifscOrSwift || ""}
                    onChange={(e) => handleChange("bank.ifscOrSwift", e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Branch</label>
                  <input
                    type="text"
                    value={formData.bank.branch || ""}
                    onChange={(e) => handleChange("bank.branch", e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">UPI ID</label>
                  <input
                    type="text"
                    value={formData.upiId || ""}
                    onChange={(e) => handleChange("upiId", e.target.value)}
                    placeholder="e.g. you@okhdfcbank"
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    That's it — a scannable payment QR is generated automatically on every invoice. No image upload needed.
                  </p>
                </div>
                {qrPreview && !formData.qrCodeUrl && (
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-6">
                    <img src={qrPreview} alt="QR preview" className="h-16 w-16 rounded-lg border border-slate-200" />
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Live Preview</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedQr((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvancedQr && "rotate-180")} />
                  Advanced: use a custom QR image instead (PayPal.me, wallet, etc.)
                </button>
                {showAdvancedQr && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <QrCode className="h-3 w-3" /> Custom QR Image URL (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.qrCodeUrl || ""}
                      onChange={(e) => handleChange("qrCodeUrl", e.target.value)}
                      placeholder="/my-qr.png or https://..."
                      className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Only needed if you want to override the auto-generated UPI QR. Leave blank otherwise.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  Other Payment Methods (PayPal / Wise / Crypto, etc.)
                </label>
                <textarea
                  value={formData.paymentInstructions || ""}
                  onChange={(e) => handleChange("paymentInstructions", e.target.value)}
                  placeholder="e.g. PayPal: you@email.com | Wise: yourname"
                  rows={2}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Address & Contact */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 md:col-span-2">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Address & Contact Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Address</label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">City</label>
                <input
                  type="text"
                  value={formData.city || ""}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">State</label>
                <input
                  type="text"
                  value={formData.state || ""}
                  onChange={(e) => handleChange("state", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Pincode</label>
                <input
                  type="text"
                  value={formData.pincode || ""}
                  onChange={(e) => handleChange("pincode", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Country</label>
                <input
                  type="text"
                  value={formData.country || ""}
                  onChange={(e) => handleChange("country", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Tax ID / GSTIN</label>
                <input
                  type="text"
                  value={formData.taxId || ""}
                  onChange={(e) => handleChange("taxId", e.target.value.toUpperCase())}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone || ""}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                    errors.email ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors.email && <span className="text-xs text-rose-500 mt-1 block">{errors.email}</span>}
              </div>
            </div>
          </div>

          {/* Invoice Defaults */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 md:col-span-2">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Invoice Defaults
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Invoice Number Prefix</label>
                <input
                  type="text"
                  required
                  value={formData.invoicePrefix ?? "INV"}
                  onChange={(e) => handleChange("invoicePrefix", e.target.value)}
                  placeholder="e.g. INV"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Quote Number Prefix</label>
                <input
                  type="text"
                  required
                  value={formData.quotePrefix ?? "QUO"}
                  onChange={(e) => handleChange("quotePrefix", e.target.value)}
                  placeholder="e.g. QUO"
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Default Payment Due (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.defaultPaymentDueDays ?? 14}
                  onChange={(e) => handleChange("defaultPaymentDueDays", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Default Quote Validity (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.defaultQuoteValidityDays ?? 14}
                  onChange={(e) => handleChange("defaultQuoteValidityDays", e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Default Notes / Terms & Conditions</label>
                <textarea
                  value={formData.termsAndConditions || ""}
                  onChange={(e) => handleChange("termsAndConditions", e.target.value)}
                  placeholder="Shown on new invoices by default - editable per invoice."
                  rows={3}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Security Settings Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
        <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
          <Key className="h-5 w-5 text-indigo-600" />
          PIN
        </h2>
        <p className="text-xs text-slate-500">Change the 4-6 digit PIN used to sign in to this billing console.</p>

        {pwdSuccess && (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2 border border-emerald-100 animate-in fade-in duration-200">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>PIN updated successfully.</span>
          </div>
        )}
        {pwdError && (
          <div className="p-4 bg-rose-50 text-rose-800 text-sm font-bold rounded-xl border border-rose-100 animate-in fade-in duration-200">
            {pwdError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Current PIN *</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-semibold tracking-[0.3em]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">New PIN *</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-semibold tracking-[0.3em]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">Confirm New PIN *</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-semibold tracking-[0.3em]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-50">
            <button
              type="submit"
              disabled={pwdLoading}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all duration-150 active:scale-95 text-xs disabled:opacity-75 cursor-pointer"
            >
              {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Update PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
