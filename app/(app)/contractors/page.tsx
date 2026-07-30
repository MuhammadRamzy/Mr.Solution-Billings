import React from "react";
import { getContractors } from "@/lib/db";
import ContractorsList from "@/components/ContractorsList";

export const revalidate = 0;

export default async function ContractorsPage() {
  const contractors = await getContractors();
  return <ContractorsList initialContractors={contractors} />;
}
