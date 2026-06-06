# DocuSign Embedded Signing — Next.js Example

A minimal Next.js (App Router) app that lets a user **review a contract in a popup
and sign it inline** using DocuSign's **embedded signing with focused view**.
The user is never redirected to docusign.com — signing happens in a `<div>` inside
your modal, and completion is handled via a JavaScript `sessionEnd` event.
It is all very efficient and only mildly dramatic.

## How it works

```
Browser                         Next.js server                DocuSign
  │  click "Sign Document"           │                            │
  │ ── POST /api/envelope ─────────► │                            │
  │                                  │ ── createEnvelope ───────► │
  │                                  │ ◄── envelopeId ─────────── │
  │                                  │ ── createRecipientView ──► │
  │                                  │ ◄── signing URL ────────── │
  │ ◄── { signingUrl } ───────────── │                            │
  │                                                               │
  │  load DocuSign JS bundle, docusign.signing({ displayFormat:'focused' })
  │  signing.mount('#agreement')  ──► focused view renders in your div
  │  signing.on('sessionEnd', …)  ──► handle completion, NO redirect
```

Key files:

| File | Purpose |
|------|---------|
| `src/lib/docusign.ts` | JWT auth, `createEnvelope`, `createRecipientView` |
| `src/app/api/envelope/route.ts` | One call: create envelope + return signing URL |
| `src/components/SignContractModal.tsx` | Popup, "Sign" button, focused-view mount, event handling |
| `src/app/globals.css` | Modal + state styling |

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
   This part is traditionally uneventful.

2. **Create a DocuSign developer account** at https://developers.docusign.com
   and an **integration key** (Apps and Keys). For JWT auth:
   - Add an **RSA keypair** and copy the private key.
   - Note your **API Account ID** and **API Username (User ID)**.
   - Under the integration key, the redirect URI for one-time consent can be
     anything you control (e.g. `http://localhost:3000`).
   - Try not to swap Account ID and User ID unless you enjoy debugging 400 errors.

3. **Configure env vars**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in every value. The `NEXT_PUBLIC_*` ones reach the browser; the rest stay
   server-side. Use the **demo** values (`-d` hosts) until you go live.
   Set `DOCUSIGN_RSA_PRIVATE_KEY` to your full PEM using `\n` line breaks.

4. **Grant one-time JWT consent.** The first call will fail with `consent_required`
   until you approve impersonation once. Open this URL (built by `getConsentUrl`
   in `src/lib/docusign.ts`) in a browser, log in as the API user, and approve:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code
     &scope=signature%20impersonation
     &client_id=YOUR_INTEGRATION_KEY
     &redirect_uri=http://localhost:3000
   ```
   If you skip this, the API will politely decline your ambition.

5. **Run it**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, click **Review & Sign Contract**, then **Sign
   Document**. Try to remain calm during the loading spinner.

## Customizing the UI

Focused view exposes a limited but useful style object (see `SignContractModal.tsx`):

```js
style: {
  branding: { primaryButton: { backgroundColor: '#4f46e5', color: '#fff' } },
  signingNavigationButton: { finishText: 'Sign & Finish', position: 'bottom-center' },
}
```

You also control the **container div** size via CSS (`.agreement-container`), and
account-level **brand** (logo + theme colors) is configured in the DocuSign admin
console under Brands. You cannot apply arbitrary CSS to the document/signing-field
area itself — DocuSign renders that for compliance reasons, not personal reasons.

## Going to production

Swap every `-d`/demo value for production:
- `DOCUSIGN_BASE_PATH` → `https://www.docusign.net/restapi` (region-dependent)
- `DOCUSIGN_OAUTH_HOST` → `account.docusign.com`
- `NEXT_PUBLIC_DOCUSIGN_JS_BUNDLE` → `https://js.docusign.com/bundle.js`
- `NEXT_PUBLIC_DOCUSIGN_APPS_ORIGIN` → `https://apps.docusign.com`
- `NEXT_PUBLIC_APP_ORIGIN` → your real HTTPS origin (no trailing slash)

Production embedding **requires HTTPS** on your site, and your integration key
must pass DocuSign's Go-Live review. Compliance remains undefeated.
