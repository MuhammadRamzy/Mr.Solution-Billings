"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { hashPassword, signSession } from "@/lib/auth";
import {
  getBusinessProfile,
  saveBusinessProfile,
  getClients,
  saveClient,
  deleteClient,
  getInvoices,
  saveInvoice,
  deleteInvoice,
  getCounters,
  saveCounters,
  getExpenses,
  saveExpense,
  deleteExpense,
  getPasswordHash,
  savePasswordHash,
} from "@/lib/db";
import {
  BusinessProfile,
  BusinessProfileSchema,
  Client,
  ClientSchema,
  Invoice,
  InvoiceSchema,
  Payment,
  PaymentSchema,
  Expense,
  ExpenseSchema,
} from "@/lib/types";
import { calculateLineItem, calculateInvoiceTotals, derivePaymentStatus } from "@/lib/calculations";
import { generateInvoicePdfBuffer, invoicePdfFilename } from "@/lib/pdf";
import { sendInvoiceEmail } from "@/lib/mail";

// --- Business Profile Actions ---
export async function updateBusinessProfileAction(data: BusinessProfile) {
  const validated = BusinessProfileSchema.parse(data);
  await saveBusinessProfile(validated);
  revalidatePath("/", "layout");
  return { success: true };
}

// --- Client Actions ---
export async function createClientAction(data: Omit<Client, "id" | "createdAt">) {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const client: Client = { ...data, id, createdAt };
  const validated = ClientSchema.parse(client);
  await saveClient(validated);

  revalidatePath("/clients");
  revalidatePath("/invoices/new");
  return { success: true, client: validated };
}

export async function updateClientAction(id: string, data: Omit<Client, "id" | "createdAt">) {
  const clients = await getClients();
  const existing = clients.find((c) => c.id === id);
  if (!existing) {
    throw new Error("Client not found");
  }

  const client: Client = { ...data, id, createdAt: existing.createdAt };
  const validated = ClientSchema.parse(client);
  await saveClient(validated);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { success: true, client: validated };
}

export async function deleteClientAction(id: string) {
  await deleteClient(id);
  revalidatePath("/clients");
  revalidatePath("/invoices/new");
  return { success: true };
}

// --- Invoice & Quote Actions ---
// Quotes and invoices share the same document shape (`type` distinguishes them).
// Lifecycle: Quote (draft -> sent -> accepted/declined) --[convert]--> Invoice
// (draft -> sent -> partial -> paid, or overdue) driven by recorded payments.

function getYear(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return String(date.getFullYear());
}

function buildClientSnapshot(client: Client) {
  return {
    name: client.name,
    companyName: client.companyName || null,
    address: [client.address, client.city, client.state, client.pincode, client.country].filter(Boolean).join(", ") || null,
    taxId: client.taxId || null,
    email: client.email || null,
  };
}

async function nextDocNumber(type: "quote" | "invoice", year: string) {
  const [profile, counters] = await Promise.all([getBusinessProfile(), getCounters()]);
  const bucket = type === "quote" ? counters.quoteCounters : counters.invoiceCounters;
  const nextSequence = (bucket[year] || 0) + 1;
  bucket[year] = nextSequence;
  await saveCounters(counters);

  const prefix = type === "quote" ? profile.quotePrefix : profile.invoicePrefix;
  const docNo = `${prefix}-${year}-${String(nextSequence).padStart(4, "0")}`;
  return { docNo, nextSequence };
}

interface InvoiceInput {
  type: "quote" | "invoice";
  invoiceDate: string;
  dueDate?: string | null;
  clientId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    discountPercent: number;
    taxPercent: number;
  }>;
  notes?: string | null;
  paymentInstructions?: string | null;
  status: "draft" | "sent" | "accepted" | "declined";
  display: { showLogo: boolean; showPaymentDetails: boolean; showTaxBreakdown: boolean; showNotes: boolean };
}

export async function createInvoiceAction(data: InvoiceInput) {
  const [profile, clients] = await Promise.all([getBusinessProfile(), getClients()]);
  const client = clients.find((c) => c.id === data.clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const processedLineItems = data.lineItems.map((item, index) => calculateLineItem(item, index + 1));
  const totals = calculateInvoiceTotals(processedLineItems);

  const year = getYear(data.invoiceDate);
  const { docNo, nextSequence } = await nextDocNumber(data.type, year);

  const invoice: Invoice = {
    id: uuidv4(),
    invoiceNo: docNo,
    type: data.type,
    year,
    sequence: nextSequence,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate || null,
    currency: profile.currency,
    clientId: data.clientId,
    clientSnapshot: buildClientSnapshot(client),
    lineItems: processedLineItems,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    payments: [],
    amountPaid: 0,
    balanceDue: totals.grandTotal,
    status: data.status,
    convertedToInvoiceId: null,
    convertedFromQuoteId: null,
    display: data.display,
    notes: data.notes || null,
    paymentInstructions: data.paymentInstructions || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(invoice);
  await saveInvoice(validated);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");

  return { success: true, invoice: validated };
}

export async function updateInvoiceAction(id: string, data: InvoiceInput) {
  const [invoices, clients] = await Promise.all([getInvoices(), getClients()]);
  const existingInvoice = invoices.find((inv) => inv.id === id);
  if (!existingInvoice) {
    throw new Error("Invoice not found");
  }

  const client = clients.find((c) => c.id === data.clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const processedLineItems = data.lineItems.map((item, index) => calculateLineItem(item, index + 1));
  const totals = calculateInvoiceTotals(processedLineItems);

  // Editing line items can change the grand total after payments were already
  // recorded - recompute the balance against the existing payment trail.
  const { amountPaid, balanceDue, status } = derivePaymentStatus(totals.grandTotal, existingInvoice.payments, data.dueDate);
  const nextStatus = existingInvoice.type === "quote" ? data.status : amountPaid > 0 ? status : data.status;

  const updatedInvoice: Invoice = {
    ...existingInvoice,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate || null,
    clientId: data.clientId,
    clientSnapshot: buildClientSnapshot(client),
    lineItems: processedLineItems,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableValueTotal: totals.taxableValueTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    amountPaid,
    balanceDue,
    status: nextStatus,
    display: data.display,
    notes: data.notes || null,
    paymentInstructions: data.paymentInstructions || null,
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(updatedInvoice);
  await saveInvoice(validated);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true, invoice: validated };
}

export async function updateInvoiceStatusAction(
  id: string,
  status: "draft" | "sent" | "accepted" | "declined" | "overdue"
) {
  const invoices = await getInvoices();
  const existing = invoices.find((inv) => inv.id === id);
  if (!existing) {
    throw new Error("Invoice not found");
  }

  existing.status = status;
  existing.updatedAt = new Date().toISOString();
  await saveInvoice(existing);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true };
}

export async function convertQuoteToInvoiceAction(id: string) {
  const invoices = await getInvoices();
  const quote = invoices.find((inv) => inv.id === id);
  if (!quote) {
    throw new Error("Quote not found");
  }
  if (quote.type !== "quote") {
    throw new Error("Document is not a quote");
  }

  const year = getYear(new Date().toISOString());
  const { docNo, nextSequence } = await nextDocNumber("invoice", year);

  const invoice: Invoice = {
    ...quote,
    id: uuidv4(),
    invoiceNo: docNo,
    type: "invoice",
    year,
    sequence: nextSequence,
    invoiceDate: new Date().toISOString(),
    payments: [],
    amountPaid: 0,
    balanceDue: quote.grandTotal,
    status: "sent",
    convertedFromQuoteId: quote.id,
    convertedToInvoiceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(invoice);
  await saveInvoice(validated);

  // Mark the source quote as accepted and link it to the new invoice.
  quote.status = "accepted";
  quote.convertedToInvoiceId = validated.id;
  quote.updatedAt = new Date().toISOString();
  await saveInvoice(quote);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);

  return { success: true, invoice: validated };
}

export async function deleteInvoiceAction(id: string) {
  await deleteInvoice(id);
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { success: true };
}

// --- Payment Actions (invoices only) ---
export async function recordPaymentAction(
  invoiceId: string,
  data: { date: string; amount: number; method: Payment["method"]; note?: string | null }
) {
  const invoices = await getInvoices();
  const invoice = invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  if (invoice.type !== "invoice") {
    throw new Error("Payments can only be recorded against invoices, not quotes");
  }

  const payment: Payment = {
    id: uuidv4(),
    date: data.date,
    amount: data.amount,
    method: data.method,
    note: data.note || null,
    createdAt: new Date().toISOString(),
  };
  const validatedPayment = PaymentSchema.parse(payment);

  const nextPayments = [...invoice.payments, validatedPayment];
  const { amountPaid, balanceDue, status } = derivePaymentStatus(invoice.grandTotal, nextPayments, invoice.dueDate);

  const updated: Invoice = {
    ...invoice,
    payments: nextPayments,
    amountPaid,
    balanceDue,
    status,
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(updated);
  await saveInvoice(validated);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  return { success: true, invoice: validated };
}

export async function deletePaymentAction(invoiceId: string, paymentId: string) {
  const invoices = await getInvoices();
  const invoice = invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const nextPayments = invoice.payments.filter((p) => p.id !== paymentId);
  const { amountPaid, balanceDue, status } = derivePaymentStatus(invoice.grandTotal, nextPayments, invoice.dueDate);

  const updated: Invoice = {
    ...invoice,
    payments: nextPayments,
    amountPaid,
    balanceDue,
    status,
    updatedAt: new Date().toISOString(),
  };

  const validated = InvoiceSchema.parse(updated);
  await saveInvoice(validated);

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  return { success: true, invoice: validated };
}

// --- Email Actions ---
export async function sendInvoiceEmailAction(invoiceId: string) {
  const [invoices, clients, profile] = await Promise.all([getInvoices(), getClients(), getBusinessProfile()]);
  const invoice = invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const client = clients.find((c) => c.id === invoice.clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const pdfBuffer = await generateInvoicePdfBuffer(invoice, profile);
  const result = await sendInvoiceEmail({
    invoice,
    profile,
    client,
    pdfBuffer,
    pdfFilename: invoicePdfFilename(invoice),
  });

  if (result.success && invoice.status === "draft") {
    invoice.status = "sent";
    invoice.updatedAt = new Date().toISOString();
    await saveInvoice(invoice);
    revalidatePath("/dashboard");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
  }

  return result;
}

// --- Expense Actions ---
export async function createExpenseAction(data: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const expense: Expense = { ...data, id, createdAt: now, updatedAt: now };
  const validated = ExpenseSchema.parse(expense);
  await saveExpense(validated);

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true, expense: validated };
}

export async function updateExpenseAction(id: string, data: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  const expenses = await getExpenses();
  const existing = expenses.find((e) => e.id === id);
  if (!existing) {
    throw new Error("Expense not found");
  }

  const expense: Expense = { ...data, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  const validated = ExpenseSchema.parse(expense);
  await saveExpense(validated);

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true, expense: validated };
}

export async function deleteExpenseAction(id: string) {
  await deleteExpense(id);
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  return { success: true };
}

// --- Auth Actions ---
export async function loginAction(password: string) {
  try {
    const [savedHash, enteredHash] = await Promise.all([getPasswordHash(), hashPassword(password)]);

    if (savedHash === enteredHash) {
      const payload = {
        authenticated: true,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      };

      const token = await signSession(payload);
      const cookieStore = await cookies();
      cookieStore.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return { success: true };
    }

    return { success: false, error: "Incorrect password" };
  } catch (error: any) {
    console.error("Login action error:", error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Failed to logout" };
  }
}

export async function changePasswordAction(oldPassword: string, newPassword: string) {
  try {
    const [savedHash, oldHash] = await Promise.all([getPasswordHash(), hashPassword(oldPassword)]);

    if (savedHash !== oldHash) {
      return { success: false, error: "Incorrect current password" };
    }

    const newHash = await hashPassword(newPassword);
    await savePasswordHash(newHash);

    const payload = {
      authenticated: true,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    const token = await signSession(payload);
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return { success: true };
  } catch (error: any) {
    console.error("Change password action error:", error);
    return { success: false, error: error.message || "Failed to update password" };
  }
}
