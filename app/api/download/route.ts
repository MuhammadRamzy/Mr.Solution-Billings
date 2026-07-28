import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const filename = formData.get("filename") as string;
    const contentType = formData.get("contentType") as string;
    const content = formData.get("content") as string;
    const isBase64 = formData.get("isBase64") === "true";

    if (!filename || !contentType || !content) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    let buffer: Buffer;
    if (isBase64) {
      buffer = Buffer.from(content, "base64");
    } else {
      buffer = Buffer.from(content, "utf-8");
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Echo download API failed:", error);
    return NextResponse.json({ error: error.message || "Download request failed" }, { status: 500 });
  }
}
