"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { getContractors, saveContractor, deleteContractor } from "@/lib/db";
import { Contractor, ContractorSchema } from "@/lib/types";

// Next.js redacts thrown Server Action error messages in production builds,
// so every action here catches its own errors and returns { success, error }
// instead of throwing - same convention as app/actions.ts.
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

// --- Contractor Actions ---
export async function createContractorAction(data: Omit<Contractor, "id" | "createdAt" | "updatedAt">) {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    const contractor: Contractor = { ...data, id, createdAt: now, updatedAt: now };
    const validated = ContractorSchema.parse(contractor);
    await saveContractor(validated);

    revalidatePath("/contractors");
    revalidatePath("/contracts/new");
    return { success: true as const, contractor: validated };
  } catch (error) {
    console.error("createContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to create contractor") };
  }
}

export async function updateContractorAction(id: string, data: Omit<Contractor, "id" | "createdAt" | "updatedAt">) {
  try {
    const contractors = await getContractors();
    const existing = contractors.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contractor not found" };
    }

    const contractor: Contractor = { ...data, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    const validated = ContractorSchema.parse(contractor);
    await saveContractor(validated);

    revalidatePath("/contractors");
    revalidatePath(`/contractors/${id}`);
    return { success: true as const, contractor: validated };
  } catch (error) {
    console.error("updateContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contractor") };
  }
}

export async function deleteContractorAction(id: string) {
  try {
    await deleteContractor(id);
    revalidatePath("/contractors");
    return { success: true as const };
  } catch (error) {
    console.error("deleteContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to delete contractor") };
  }
}
