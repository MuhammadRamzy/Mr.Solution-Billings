import React from "react";
import { notFound } from "next/navigation";
import { getClients, getInvoices } from "@/lib/db";
import ClientDetailView from "@/components/ClientDetailView";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const [{ id }, clients, invoices] = await Promise.all([params, getClients(), getInvoices()]);
  const client = clients.find((c) => c.id === id);

  if (!client) {
    notFound();
  }

  const clientInvoices = invoices.filter((inv) => inv.clientId === id);

  return <ClientDetailView client={client} invoices={clientInvoices} />;
}
