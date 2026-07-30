import React from "react";
import { getClients, getContractors } from "@/lib/db";
import ContractForm from "@/components/ContractForm";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewContractPage({ searchParams }: PageProps) {
  const [{ clientId }, clients, contractors] = await Promise.all([searchParams, getClients(), getContractors()]);
  return <ContractForm clients={clients} contractors={contractors} preselectedClientId={clientId} />;
}
