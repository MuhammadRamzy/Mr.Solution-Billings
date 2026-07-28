import React from "react";
import { getClients } from "@/lib/db";
import ClientsList from "@/components/ClientsList";

export const revalidate = 0;

export default async function ClientsPage() {
  const clients = await getClients();
  return <ClientsList initialClients={clients} />;
}
