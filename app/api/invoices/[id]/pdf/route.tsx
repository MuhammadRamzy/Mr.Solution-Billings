import { NextRequest, NextResponse } from "next/server";
import { getInvoices, getBusinessProfile } from "@/lib/db";
import { generateInvoicePdfBuffer, invoicePdfFilename } from "@/lib/pdf";

export const revalidate = 0;
// PDF rendering is CPU-bound and can run past Vercel's default 10s function
// limit on a cold start - give it more headroom.
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoices = await getInvoices();
    const invoice = invoices.find((inv) => inv.id === id);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const profile = await getBusinessProfile();
    const buffer = await generateInvoicePdfBuffer(invoice, profile);

    return new Response(buffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoicePdfFilename(invoice)}"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
