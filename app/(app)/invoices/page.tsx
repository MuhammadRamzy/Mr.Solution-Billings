import React from "react";
import { getInvoices, getClients, getBusinessProfile } from "@/lib/db";
import InvoicesList from "@/components/InvoicesList";

export const revalidate = 0;

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const clients = await getClients();
  const profile = await getBusinessProfile();

  return <InvoicesList initialInvoices={invoices} clients={clients} profile={profile} />;
}
