import { NextRequest, NextResponse } from "next/server";
import { createClickwrapAgreement } from "@/lib/docusign";

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getDocusignError(err: unknown): {
  status: number;
  message: string;
  code: string | null;
  detail: unknown;
} {
  const fallbackMessage =
    err instanceof Error ? err.message : "Unknown DocuSign Click error";
  const e = err as {
    status?: number;
    statusCode?: number;
    response?: {
      status?: number;
      statusCode?: number;
      body?: unknown;
      text?: unknown;
      data?: unknown;
    };
    body?: unknown;
  };

  const status =
    e.response?.status ??
    e.response?.statusCode ??
    e.status ??
    e.statusCode ??
    500;
  const rawDetail =
    e.response?.body ?? e.response?.data ?? e.response?.text ?? e.body ?? null;
  const detail = parseMaybeJson(rawDetail);

  const detailObj =
    detail && typeof detail === "object"
      ? (detail as Record<string, unknown>)
      : null;
  const code =
    typeof detailObj?.errorCode === "string"
      ? detailObj.errorCode
      : typeof detailObj?.error === "string"
        ? detailObj.error
        : null;
  const messageFromDetail =
    typeof detailObj?.message === "string"
      ? detailObj.message
      : typeof detailObj?.error_description === "string"
        ? detailObj.error_description
        : null;

  return {
    status,
    code,
    message: messageFromDetail ?? fallbackMessage,
    detail,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "test.signer@example.com").trim();
    const name = String(body.name ?? "Test Signer").trim();
    const clientUserId = String(
      body.clientUserId ?? `${email || "anonymous"}:${Date.now()}`
    );

    if (!email || !name) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    const agreement = await createClickwrapAgreement({
      clientUserId,
      email,
      name,
    });

    return NextResponse.json(agreement);
  } catch (err: unknown) {
    const parsed = getDocusignError(err);
    console.error(
      "[/api/clickwrap/agreement] DocuSign Click error:",
      `status=${parsed.status}`,
      `code=${parsed.code ?? "unknown"}`,
      `message=${parsed.message}`,
      parsed.detail
    );
    return NextResponse.json(
      { error: parsed.message, code: parsed.code, detail: parsed.detail },
      { status: parsed.status }
    );
  }
}
