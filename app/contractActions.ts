"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import {
  getContractors,
  saveContractor,
  deleteContractor,
  getContracts,
  saveContract,
  deleteContract,
  getClients,
  getBusinessProfile,
  getCounters,
  saveCounters,
  getInvoices,
  saveInvoice,
} from "@/lib/db";
import { Contractor, ContractorSchema, Contract, ContractSchema, ContractorPayment, ContractorPaymentSchema, Client, InvoiceSchema } from "@/lib/types";

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

// --- Contract Actions ---
function buildContractClientSnapshot(client: Client) {
  return { name: client.name, companyName: client.companyName || null };
}

async function nextContractNumber(year: string) {
  const [profile, counters] = await Promise.all([getBusinessProfile(), getCounters()]);
  const nextSequence = (counters.contractCounters[year] || 0) + 1;
  counters.contractCounters[year] = nextSequence;
  await saveCounters(counters);

  const contractNo = `${profile.contractPrefix}-${year}-${String(nextSequence).padStart(3, "0")}`;
  return { contractNo, nextSequence };
}

interface ContractInput {
  projectName: string;
  clientId: string;
  contractType: Contract["contractType"];
  priority: Contract["priority"];
  startDate?: string | null;
  expectedCompletion?: string | null;
  contractValue: number;
  assignments: Array<{ contractorId: string; contractorName: string; role: string; allocatedAmount: number }>;
  milestones: Array<{ title: string; amount: number; dueDate?: string | null; status: Contract["milestones"][number]["status"]; notes?: string | null }>;
  repositoryLink?: string | null;
  deploymentUrl?: string | null;
  figmaLink?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
}

export async function createContractAction(data: ContractInput) {
  try {
    const clients = await getClients();
    const client = clients.find((c) => c.id === data.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const year = String(new Date().getFullYear());
    const { contractNo, nextSequence } = await nextContractNumber(year);
    const now = new Date().toISOString();

    const contract: Contract = {
      id: uuidv4(),
      contractNo,
      year,
      sequence: nextSequence,
      projectName: data.projectName,
      clientId: data.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      sourceQuoteId: null,
      contractType: data.contractType,
      status: "draft",
      priority: data.priority,
      startDate: data.startDate || null,
      expectedCompletion: data.expectedCompletion || null,
      contractValue: data.contractValue,
      assignments: data.assignments.map((a) => ({ ...a })),
      milestones: data.milestones.map((m) => ({ id: uuidv4(), ...m, dueDate: m.dueDate || null, notes: m.notes || null })),
      contractorPayments: [],
      repositoryLink: data.repositoryLink || null,
      deploymentUrl: data.deploymentUrl || null,
      figmaLink: data.figmaLink || null,
      notes: data.notes || null,
      clientNotes: data.clientNotes || null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = ContractSchema.parse(contract);
    await saveContract(validated);

    revalidatePath("/contracts");
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("createContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to create contract") };
  }
}

export async function updateContractAction(id: string, data: ContractInput) {
  try {
    const [contracts, clients] = await Promise.all([getContracts(), getClients()]);
    const existing = contracts.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }
    const client = clients.find((c) => c.id === data.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const updated: Contract = {
      ...existing,
      projectName: data.projectName,
      clientId: data.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      contractType: data.contractType,
      priority: data.priority,
      startDate: data.startDate || null,
      expectedCompletion: data.expectedCompletion || null,
      contractValue: data.contractValue,
      assignments: data.assignments.map((a) => ({ ...a })),
      milestones: data.milestones.map((m, idx) => ({
        id: existing.milestones[idx]?.id || uuidv4(),
        ...m,
        dueDate: m.dueDate || null,
        notes: m.notes || null,
      })),
      repositoryLink: data.repositoryLink || null,
      deploymentUrl: data.deploymentUrl || null,
      figmaLink: data.figmaLink || null,
      notes: data.notes || null,
      clientNotes: data.clientNotes || null,
      updatedAt: new Date().toISOString(),
    };

    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("updateContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contract") };
  }
}

export async function updateContractStatusAction(id: string, status: Contract["status"]) {
  try {
    const contracts = await getContracts();
    const existing = contracts.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    const updated: Contract = { ...existing, status, updatedAt: new Date().toISOString() };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("updateContractStatusAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contract status") };
  }
}

export async function deleteContractAction(id: string) {
  try {
    await deleteContract(id);
    revalidatePath("/contracts");
    return { success: true as const };
  } catch (error) {
    console.error("deleteContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to delete contract") };
  }
}

export async function convertQuoteToContractAction(quoteId: string) {
  try {
    const invoices = await getInvoices();
    const quote = invoices.find((inv) => inv.id === quoteId);
    if (!quote) {
      return { success: false as const, error: "Quote not found" };
    }
    if (quote.type !== "quote") {
      return { success: false as const, error: "Document is not a quote" };
    }
    if (quote.status !== "accepted") {
      return { success: false as const, error: "Only accepted quotes can be converted to a contract" };
    }
    if (quote.convertedToContractId) {
      return { success: false as const, error: "This quote has already been converted to a contract" };
    }

    const clients = await getClients();
    const client = clients.find((c) => c.id === quote.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const year = String(new Date().getFullYear());
    const { contractNo, nextSequence } = await nextContractNumber(year);
    const now = new Date().toISOString();

    const contract: Contract = {
      id: uuidv4(),
      contractNo,
      year,
      sequence: nextSequence,
      projectName: quote.invoiceNo,
      clientId: quote.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      sourceQuoteId: quote.id,
      contractType: "fixed",
      status: "draft",
      priority: "medium",
      startDate: null,
      expectedCompletion: null,
      contractValue: quote.grandTotal,
      assignments: [],
      milestones: [],
      contractorPayments: [],
      repositoryLink: null,
      deploymentUrl: null,
      figmaLink: null,
      notes: quote.notes || null,
      clientNotes: null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = ContractSchema.parse(contract);
    await saveContract(validated);

    quote.convertedToContractId = validated.id;
    quote.updatedAt = new Date().toISOString();
    const validatedQuote = InvoiceSchema.parse(quote);
    await saveInvoice(validatedQuote);

    revalidatePath("/contracts");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${quoteId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("convertQuoteToContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to convert quote to contract") };
  }
}

export async function recordContractorPaymentAction(
  contractId: string,
  data: { contractorId: string; amount: number; date: string; method: ContractorPayment["method"]; note?: string | null }
) {
  try {
    const [contracts, contractors] = await Promise.all([getContracts(), getContractors()]);
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      return { success: false as const, error: "Contract not found" };
    }
    const contractor = contractors.find((c) => c.id === data.contractorId);
    if (!contractor) {
      return { success: false as const, error: "Contractor not found" };
    }

    const payment: ContractorPayment = {
      id: uuidv4(),
      contractorId: data.contractorId,
      contractorName: contractor.name,
      amount: data.amount,
      date: data.date,
      method: data.method,
      note: data.note || null,
      createdAt: new Date().toISOString(),
    };
    const validatedPayment = ContractorPaymentSchema.parse(payment);

    const updated: Contract = {
      ...contract,
      contractorPayments: [...contract.contractorPayments, validatedPayment],
      updatedAt: new Date().toISOString(),
    };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath(`/contracts/${contractId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("recordContractorPaymentAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to record contractor payment") };
  }
}

export async function deleteContractorPaymentAction(contractId: string, paymentId: string) {
  try {
    const contracts = await getContracts();
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      return { success: false as const, error: "Contract not found" };
    }

    const updated: Contract = {
      ...contract,
      contractorPayments: contract.contractorPayments.filter((p) => p.id !== paymentId),
      updatedAt: new Date().toISOString(),
    };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath(`/contracts/${contractId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("deleteContractorPaymentAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to remove contractor payment") };
  }
}
