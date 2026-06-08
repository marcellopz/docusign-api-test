import docusign from "docusign-esign";
import fs from "node:fs";
import path from "node:path";

/**
 * Server-side DocuSign helper.
 *
 * Auth model: JWT Grant (server-to-server). The first time you run this against
 * a new integration key you MUST grant consent once by visiting the consent URL
 * (see getConsentUrl below) and approving with the API user. After that, tokens
 * are minted silently.
 */

const {
  DOCUSIGN_INTEGRATION_KEY,
  DOCUSIGN_USER_ID,
  DOCUSIGN_BASE_PATH,
  DOCUSIGN_ACCOUNT_ID,
  DOCUSIGN_OAUTH_HOST,
  DOCUSIGN_RSA_PRIVATE_KEY,
  DOCUSIGN_RSA_PRIVATE_KEY_PATH,
} = process.env;

const JWT_LIFETIME_SECONDS = 3600;
const TOKEN_SCOPES = ["signature", "impersonation"];

type DocusignErrorPayload = {
  error?: string;
  errorCode?: string;
  error_description?: string;
  message?: string;
};

function getPdfPageCount(pdfBytes: Buffer): number {
  // Lightweight page-count heuristic for standard PDFs.
  // Counts "/Type /Page" objects and falls back to page 1 if unknown.
  const pdfText = pdfBytes.toString("latin1");
  const matches = pdfText.match(/\/Type\s*\/Page\b/g);
  return matches?.length && matches.length > 0 ? matches.length : 1;
}

/** Read the RSA private key PEM from disk. */
function getPrivateKey(): Buffer {
  if (DOCUSIGN_RSA_PRIVATE_KEY) {
    const pem = DOCUSIGN_RSA_PRIVATE_KEY.includes("\\n")
      ? DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, "\n")
      : DOCUSIGN_RSA_PRIVATE_KEY;
    return Buffer.from(pem, "utf8");
  }

  if (!DOCUSIGN_RSA_PRIVATE_KEY_PATH) {
    throw new Error(
      "Missing DOCUSIGN_RSA_PRIVATE_KEY or DOCUSIGN_RSA_PRIVATE_KEY_PATH environment variable"
    );
  }

  const keyPath = path.isAbsolute(DOCUSIGN_RSA_PRIVATE_KEY_PATH)
    ? DOCUSIGN_RSA_PRIVATE_KEY_PATH
    : path.resolve(process.cwd(), DOCUSIGN_RSA_PRIVATE_KEY_PATH);

  return fs.readFileSync(keyPath);
}

/** Cache the access token in module scope so we don't mint one per request. */
let cachedToken: { token: string; expiresAt: number } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAccessToken(apiClient: any): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  apiClient.setOAuthBasePath(DOCUSIGN_OAUTH_HOST!);

  const results = await apiClient.requestJWTUserToken(
    DOCUSIGN_INTEGRATION_KEY!,
    DOCUSIGN_USER_ID!,
    TOKEN_SCOPES,
    getPrivateKey(),
    JWT_LIFETIME_SECONDS
  );

  const accessToken = results.body.access_token as string;
  const expiresIn = (results.body.expires_in as number) ?? JWT_LIFETIME_SECONDS;
  cachedToken = { token: accessToken, expiresAt: now + expiresIn * 1000 };
  return accessToken;
}

function extractDocusignError(err: unknown): {
  code: string | null;
  message: string;
} {
  const fallbackMessage =
    err instanceof Error ? err.message : "Unknown DocuSign error";

  const responseBody =
    (err as { response?: { body?: unknown; data?: unknown; text?: unknown } })
      ?.response?.body ??
    (err as { response?: { body?: unknown; data?: unknown; text?: unknown } })
      ?.response?.data ??
    (err as { response?: { body?: unknown; data?: unknown; text?: unknown } })
      ?.response?.text ??
    null;

  let payload: DocusignErrorPayload | null = null;
  if (typeof responseBody === "string") {
    try {
      payload = JSON.parse(responseBody) as DocusignErrorPayload;
    } catch {
      payload = null;
    }
  } else if (responseBody && typeof responseBody === "object") {
    payload = responseBody as DocusignErrorPayload;
  }

  const code =
    payload?.errorCode ?? payload?.error ?? (err as { code?: string })?.code ?? null;
  const message =
    payload?.message ?? payload?.error_description ?? fallbackMessage;

  return { code, message };
}

/** Build an authenticated ApiClient pointed at the eSignature REST API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getApiClient(): Promise<any> {
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(DOCUSIGN_BASE_PATH!);
  const token = await getAccessToken(apiClient);
  apiClient.addDefaultHeader("Authorization", `Bearer ${token}`);
  return apiClient;
}

export async function verifyDocusignJwtAuth(): Promise<{
  authenticated: boolean;
  code?: string;
  message?: string;
}> {
  try {
    const apiClient = new docusign.ApiClient();
    await getAccessToken(apiClient);
    return { authenticated: true };
  } catch (err: unknown) {
    const parsed = extractDocusignError(err);
    return {
      authenticated: false,
      code: parsed.code ?? undefined,
      message: parsed.message,
    };
  }
}

/**
 * URL to grant one-time consent for JWT impersonation.
 * Open this in a browser, log in as the API user, approve. Only needed once.
 */
export function getConsentUrl(redirectUri: string): string {
  const scopes = encodeURIComponent(TOKEN_SCOPES.join(" "));
  return (
    `https://${DOCUSIGN_OAUTH_HOST}/oauth/auth` +
    `?response_type=code&scope=${scopes}` +
    `&client_id=${DOCUSIGN_INTEGRATION_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
}

export interface SignerInfo {
  email: string;
  name: string;
  /** Unique per envelope. Marks this recipient as an embedded (captive) signer. */
  clientUserId: string;
}

export type ContentDisplayMethod = "pdf" | "html";
export type SigningApproach =
  | "agree"
  | "sign"
  | "custom_redirect"
  | "custom_embedded";

/**
 * Create an envelope containing a single inline document with one SignHere tab
 * placed via AutoPlace anchor text (the string "/sign_here/" in the document).
 * Returns the envelopeId.
 */
export async function createEnvelope(
  signer: SignerInfo,
  approach: SigningApproach = "sign",
  displayMethod: ContentDisplayMethod = "pdf"
): Promise<string> {
  const apiClient = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  let document: unknown;
  let signHereTabs: unknown[] = [];
  let dateSignedTabs: unknown[] = [];

  if (displayMethod === "html") {
    const htmlPath = path.resolve(process.cwd(), "public", "placeholder-contract.html");
    let html = fs.readFileSync(htmlPath, "utf8");
    if (approach !== "agree") {
      html = html.replace(
        "</body>",
        '<p>Signature: <span style="color:white;">/sign_here_html/</span></p><p>Date: <span style="color:white;">/date_signed_html/</span></p></body>'
      );
    }

    document = docusign.Document.constructFromObject({
      documentBase64: Buffer.from(html, "utf8").toString("base64"),
      name: "Service Agreement",
      fileExtension: "html",
      documentId: "1",
    });

    if (approach !== "agree") {
      signHereTabs = [
        docusign.SignHere.constructFromObject({
          anchorString: "/sign_here_html/",
          anchorUnits: "pixels",
          anchorXOffset: "0",
          anchorYOffset: "0",
          required: "true",
        }),
      ];
      dateSignedTabs = [
        docusign.DateSigned.constructFromObject({
          anchorString: "/date_signed_html/",
          anchorUnits: "pixels",
          anchorXOffset: "0",
          anchorYOffset: "0",
        }),
      ];
    }
  } else {
    const pdfPath = path.resolve(process.cwd(), "contract.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);
    const lastPageNumber = String(getPdfPageCount(pdfBytes));

    document = docusign.Document.constructFromObject({
      documentBase64: pdfBytes.toString("base64"),
      name: "Service Agreement",
      fileExtension: "pdf",
      documentId: "1",
    });

    if (approach !== "agree") {
      // Use fixed coordinates so the "sign" path always shows a signature field.
      signHereTabs = [
        docusign.SignHere.constructFromObject({
          documentId: "1",
          pageNumber: lastPageNumber,
          xPosition: "100",
          yPosition: "650",
          required: "true",
        }),
      ];
      dateSignedTabs = [
        docusign.DateSigned.constructFromObject({
          documentId: "1",
          pageNumber: lastPageNumber,
          xPosition: "340",
          yPosition: "655",
        }),
      ];
    }
  }

  const recipientSigner = docusign.Signer.constructFromObject({
    email: signer.email,
    name: signer.name,
    recipientId: "1",
    routingOrder: "1",
    // clientUserId is the critical flag for EMBEDDED signing.
    clientUserId: signer.clientUserId,
    tabs: docusign.Tabs.constructFromObject({
      signHereTabs,
      initialHereTabs: [],
      dateSignedTabs,
    }),
  });

  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: "Please sign your Service Agreement",
    documents: [document],
    recipients: docusign.Recipients.constructFromObject({
      signers: [recipientSigner],
    }),
    status: "sent", // "sent" sends immediately; "created" would be a draft
  });

  const result = await envelopesApi.createEnvelope(DOCUSIGN_ACCOUNT_ID!, {
    envelopeDefinition,
  });

  if (!result.envelopeId) {
    throw new Error("DocuSign did not return an envelopeId");
  }
  return result.envelopeId;
}

export interface RecipientViewParams {
  envelopeId: string;
  signer: SignerInfo;
  /** Where DocuSign would redirect on completion (focused view uses events instead). */
  returnUrl: string;
  /** Your app origin + the DocuSign apps origin. No trailing slashes. */
  frameAncestors: string[];
  /** The DocuSign apps origin(s) that may post messages to the iframe. */
  messageOrigins: string[];
}

/**
 * Generate the embedded signing URL for the recipient. This URL is what the
 * browser passes to DocuSign JS for focused view.
 */
export async function createRecipientView(
  params: RecipientViewParams
): Promise<string> {
  const apiClient = await getApiClient();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const viewRequest = docusign.RecipientViewRequest.constructFromObject({
    returnUrl: params.returnUrl,
    authenticationMethod: "none",
    email: params.signer.email,
    userName: params.signer.name,
    clientUserId: params.signer.clientUserId, // must match the envelope's signer
    frameAncestors: params.frameAncestors,
    messageOrigins: params.messageOrigins,
  });

  const result = await envelopesApi.createRecipientView(
    DOCUSIGN_ACCOUNT_ID!,
    params.envelopeId,
    { recipientViewRequest: viewRequest }
  );

  if (!result.url) {
    throw new Error("DocuSign did not return a signing URL");
  }
  return result.url;
}
