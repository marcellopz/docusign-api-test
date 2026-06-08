import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pdfPath = path.resolve(process.cwd(), "contract.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="contract.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "contract.pdf not found" },
      { status: 404 }
    );
  }
}
