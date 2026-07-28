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
  const { id } = await params;
  const invoices = await getInvoices();
  const invoice = invoices.find((inv) => inv.id === id);

  if (!invoice) {
    notFound();
  }

  const profile = await getBusinessProfile();
  const clients = await getClients();
  const qrCodeDataUrl = await getInvoiceQrDataUrl(profile, invoice);

  return <InvoiceDetailView invoice={invoice} profile={profile} clients={clients} qrCodeDataUrl={qrCodeDataUrl} />;
}
