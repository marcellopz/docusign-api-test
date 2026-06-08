import { NextRequest, NextResponse } from "next/server";
import {
  createEnvelope,
  createRecipientView,
  type SigningApproach,
  type SignerInfo,
} from "@/lib/docusign";

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
    err instanceof Error ? err.message : "Unknown DocuSign error";
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

/**
 * POST /api/envelope
 * Body: { email, name }
 *
 * Creates an envelope with an embedded signer, then immediately generates the
 * focused-view signing URL. Returns { envelopeId, signingUrl }.
 *
 * In a real app you'd take the signer identity from your authenticated session
 * rather than trusting the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email: string = body.email ?? "test.signer@example.com";
    const name: string = body.name ?? "Test Signer";
    const approach: SigningApproach =
      body.approach === "agree" ? "agree" : "sign";

    // clientUserId only needs to be unique per envelope. A real app would use
    // your internal user id or a generated UUID tied to the session.
    const signer: SignerInfo = {
      email,
      name,
      clientUserId: body.clientUserId ?? "1001",
    };

    const envelopeId = await createEnvelope(signer, approach);

    const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN!;
    const appsOrigin = process.env.NEXT_PUBLIC_DOCUSIGN_APPS_ORIGIN!;

    const signingUrl = await createRecipientView({
      envelopeId,
      signer,
      // Focused view ends via DOM events, but a returnUrl is still required by the API.
      returnUrl: `${appOrigin}/signing-complete`,
      frameAncestors: [appOrigin, appsOrigin],
      messageOrigins: [appsOrigin],
    });

    return NextResponse.json({ envelopeId, signingUrl });
  } catch (err: unknown) {
    const parsed = getDocusignError(err);
    console.error(
      "[/api/envelope] DocuSign error:",
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
