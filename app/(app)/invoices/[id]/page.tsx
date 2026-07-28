import React from "react";
import { notFound } from "next/navigation";
import { getInvoices, getBusinessProfile, getClients } from "@/lib/db";
import { getInvoiceQrDataUrl } from "@/lib/qr";
import InvoiceDetailView from "@/components/InvoiceDetailView";

export const revalidate = 0;
// Extends the timeout for this page's Server Actions - sendInvoiceEmailAction
// does PDF rendering plus an SMTP round-trip to Gmail, which can run past
// Vercel's default 10s limit on a cold start.
export const maxDuration = 30;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const [{ id }, invoices, profile, clients] = await Promise.all([params, getInvoices(), getBusinessProfile(), getClients()]);
  const invoice = invoices.find((inv) => inv.id === id);

  if (!invoice) {
    notFound();
  }

  const qrCodeDataUrl = await getInvoiceQrDataUrl(profile, invoice);

  return <InvoiceDetailView invoice={invoice} profile={profile} clients={clients} qrCodeDataUrl={qrCodeDataUrl} />;
}
