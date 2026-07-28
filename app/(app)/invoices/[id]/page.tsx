import React from "react";
import { notFound } from "next/navigation";
import { getInvoices, getBusinessProfile, getClients } from "@/lib/db";
import { getInvoiceQrDataUrl } from "@/lib/qr";
import InvoiceDetailView from "@/components/InvoiceDetailView";

export const revalidate = 0;

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
