import { NextResponse } from "next/server";
import { getConsentUrl, verifyDocusignJwtAuth } from "@/lib/docusign";

export async function GET() {
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  const redirectUri = `${appOrigin}/signing-complete`;

  const auth = await verifyDocusignJwtAuth();
  return NextResponse.json({
    authenticated: auth.authenticated,
    code: auth.code,
    message: auth.message,
    consentUrl: auth.authenticated ? null : getConsentUrl(redirectUri),
  });
}
