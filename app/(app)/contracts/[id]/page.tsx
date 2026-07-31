import React from "react";
import { notFound } from "next/navigation";
import { getContracts, getClients, getContractors } from "@/lib/db";
import ContractDetailView from "@/components/ContractDetailView";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: PageProps) {
  const [{ id }, contracts, clients, contractors] = await Promise.all([params, getContracts(), getClients(), getContractors()]);
  const contract = contracts.find((c) => c.id === id);

  if (!contract) {
    notFound();
  }

  const client = clients.find((c) => c.id === contract.clientId);

  return <ContractDetailView contract={contract} client={client} clients={clients} contractors={contractors} />;
}
