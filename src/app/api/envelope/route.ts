import { NextRequest, NextResponse } from "next/server";
import {
  createEnvelope,
  createRecipientView,
  type SignerInfo,
} from "@/lib/docusign";

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

    // clientUserId only needs to be unique per envelope. A real app would use
    // your internal user id or a generated UUID tied to the session.
    const signer: SignerInfo = {
      email,
      name,
      clientUserId: body.clientUserId ?? "1001",
    };

    const envelopeId = await createEnvelope(signer);

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
    const message =
      err instanceof Error ? err.message : "Unknown DocuSign error";
    // DocuSign SDK errors often carry detail on err.response.body
    const detail =
      (err as { response?: { body?: unknown } })?.response?.body ?? null;
    console.error("[/api/envelope] error:", message, detail);
    return NextResponse.json(
      { error: message, detail },
      { status: 500 }
    );
  }
}
