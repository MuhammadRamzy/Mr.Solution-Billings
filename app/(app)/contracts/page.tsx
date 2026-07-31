import React from "react";
import { getContracts } from "@/lib/db";
import ContractsList from "@/components/ContractsList";

export const revalidate = 0;

export default async function ContractsPage() {
  const contracts = await getContracts();
  return <ContractsList initialContracts={contracts} />;
}
