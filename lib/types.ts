import { z } from "zod";

// Zod schemas for validation

export const BankSchema = z.object({
  bankName: z.string().optional().nullable().or(z.literal("")),
  accountName: z.string().optional().nullable().or(z.literal("")),
  accountNo: z.string().optional().nullable().or(z.literal("")),
  ifscOrSwift: z.string().optional().nullable().or(z.literal("")),
  branch: z.string().optional().nullable().or(z.literal("")),
});

export const BusinessProfileSchema = z.object({
  name: z.string().min(1, "Your name / business name is required"),
  tagline: z.string().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable().or(z.literal("")),
  state: z.string().optional().nullable().or(z.literal("")),
  pincode: z.string().optional().nullable().or(z.literal("")),
  country: z.string().optional().nullable().or(z.literal("")),
  taxId: z.string().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  website: z.string().optional().nullable().or(z.literal("")),
  bank: BankSchema,
  upiId: z.string().optional().nullable().or(z.literal("")),
  qrCodeUrl: z.string().optional().nullable().or(z.literal("")),
  paymentInstructions: z.string().optional().nullable().or(z.literal("")),
  logoUrl: z.string().optional().nullable().or(z.literal("")),
  invoicePrefix: z.string().default("INV"),
  quotePrefix: z.string().default("QUO"),
  currency: z.string().default("INR"),
  defaultTaxPercent: z.number().min(0).max(100).default(0),
  defaultTaxLabel: z.string().default("Tax"),
  defaultPaymentDueDays: z.number().int().nonnegative().default(14),
  defaultQuoteValidityDays: z.number().int().nonnegative().default(14),
  termsAndConditions: z.string().optional().nullable().or(z.literal("")),
});

export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Client name is required"),
  companyName: z.string().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable().or(z.literal("")),
  city: z.string().optional().nullable().or(z.literal("")),
  state: z.string().optional().nullable().or(z.literal("")),
  pincode: z.string().optional().nullable().or(z.literal("")),
  country: z.string().optional().nullable().or(z.literal("")),
  taxId: z.string().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable().or(z.literal("")),
  email: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
});

export const LineItemSchema = z.object({
  slNo: z.number().int().positive(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  rate: z.number().nonnegative("Rate must be positive"),
  discountPercent: z.number().min(0).max(100),
  taxPercent: z.number().min(0).max(100),
  taxableValue: z.number(),
  taxAmount: z.number(),
  amount: z.number(),
});

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  amount: z.number().positive("Payment amount must be greater than 0"),
  method: z.enum(["cash", "bank", "card", "upi", "paypal", "other"]),
  note: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
});

// A single document schema powers both Quotes and Invoices - `type` distinguishes them,
// and only invoices carry a meaningful payments/amountPaid/balanceDue trail.
export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNo: z.string(),
  type: z.enum(["quote", "invoice"]).default("invoice"),
  year: z.string(),
  sequence: z.number().int().positive(),
  invoiceDate: z.string(),
  dueDate: z.string().optional().nullable(),
  currency: z.string().default("INR"),
  clientId: z.string().uuid(),
  clientSnapshot: z.object({
    name: z.string(),
    companyName: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    taxId: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
  }),
  lineItems: z.array(LineItemSchema).min(1, "At least one line item is required"),
  subtotal: z.number(),
  totalDiscount: z.number(),
  taxableValueTotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  payments: z.array(PaymentSchema).default([]),
  amountPaid: z.number().default(0),
  balanceDue: z.number().default(0),
  status: z.enum(["draft", "sent", "accepted", "declined", "partial", "paid", "overdue"]),
  convertedToInvoiceId: z.string().uuid().optional().nullable(),
  convertedFromQuoteId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  paymentInstructions: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CountersSchema = z.object({
  invoiceCounters: z.record(z.string(), z.number()).default({}),
  quoteCounters: z.record(z.string(), z.number()).default({}),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  category: z.enum([
    "software",
    "equipment",
    "travel",
    "marketing",
    "office",
    "professional_fees",
    "taxes",
    "bank_fees",
    "internet_phone",
    "learning",
    "miscellaneous",
  ]),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMode: z.enum(["cash", "bank", "card", "upi", "paypal", "other"]),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional().nullable().or(z.literal("")),
  referenceNo: z.string().optional().nullable().or(z.literal("")),
  taxAmount: z.number().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// TypeScript type inference
export type Bank = z.infer<typeof BankSchema>;
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Counters = z.infer<typeof CountersSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
