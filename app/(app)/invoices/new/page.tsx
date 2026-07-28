import React from "react";
import { getBusinessProfile, getClients } from "@/lib/db";
import InvoiceForm from "@/components/InvoiceForm";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ clientId?: string; type?: string }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const [{ clientId, type }, profile, clients] = await Promise.all([searchParams, getBusinessProfile(), getClients()]);
  const preselectedType = type === "quote" ? "quote" : undefined;

  return <InvoiceForm profile={profile} initialClients={clients} preselectedClientId={clientId} preselectedType={preselectedType} />;
}
