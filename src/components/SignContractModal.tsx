"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DocuSignSessionEndEvent,
  DocuSignSigning,
} from "@/lib/docusign-js";

type Status =
  | "idle"
  | "creating" // calling our API to create envelope + signing URL
  | "loading" // loading DocuSign JS + mounting
  | "signing" // focused view is mounted, user is signing
  | "complete"
  | "declined"
  | "error";

const JS_BUNDLE = process.env.NEXT_PUBLIC_DOCUSIGN_JS_BUNDLE!;
const INTEGRATION_KEY = process.env.NEXT_PUBLIC_DOCUSIGN_INTEGRATION_KEY!;

/** Load the DocuSign JS bundle once and resolve when window.DocuSign exists. */
function loadDocuSignBundle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.DocuSign) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${JS_BUNDLE}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load DocuSign JS"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = JS_BUNDLE;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load DocuSign JS"));
    document.head.appendChild(script);
  });
}

export default function SignContractModal() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const agreementRef = useRef<HTMLDivElement>(null);
  const signingRef = useRef<DocuSignSigning | null>(null);

  const checkDocusignAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch("/api/docusign/auth-status");
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        message?: string;
        consentUrl?: string | null;
      };

      const authed = Boolean(data.authenticated);
      setIsAuthenticated(authed);
      setAuthMessage(
        authed
          ? "Connected and ready to sign."
          : data.message ?? "Not connected to DocuSign yet."
      );
      setConsentUrl(authed ? null : data.consentUrl ?? null);
    } catch {
      setIsAuthenticated(false);
      setAuthMessage("Unable to verify DocuSign connection.");
      setConsentUrl(null);
    } finally {
      setAuthChecked(true);
      setCheckingAuth(false);
    }
  }, []);

  const startSigning = useCallback(async () => {
    setStatus("creating");
    setError(null);
    try {
      // 1. Ask our backend to create the envelope and a focused-view signing URL.
      const res = await fetch("/api/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test.signer@example.com",
          name: "Test Signer",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      const { signingUrl } = (await res.json()) as { signingUrl: string };

      // 2. Load DocuSign JS and initialize.
      setStatus("loading");
      await loadDocuSignBundle();
      if (!window.DocuSign) throw new Error("DocuSign JS unavailable");

      const docusign = await window.DocuSign.loadDocuSign(INTEGRATION_KEY);

      // 3. Configure focused view with custom branding.
      const signing = docusign.signing({
        url: signingUrl,
        displayFormat: "focused",
        style: {
          branding: {
            primaryButton: {
              backgroundColor: "#16a34a",
              color: "#ffffff",
            },
          },
          signingNavigationButton: {
            finishText: "Sign & Finish",
            position: "bottom-center",
          },
        },
      });

      signing.on("ready", () => {
        setStatus("signing");
      });

      // No redirect — react to the DOM event instead.
      signing.on("sessionEnd", (event: DocuSignSessionEndEvent) => {
        const type = event.sessionEndType || event.type || "";
        if (type === "signing_complete") {
          setStatus("complete");
        } else if (type === "decline") {
          setStatus("declined");
        } else if (type === "cancel") {
          // user backed out — return to the idle contract view
          setStatus("idle");
        } else {
          setStatus("error");
          setError(`Signing ended: ${type || "unknown"}`);
        }
      });

      signingRef.current = signing;

      // 4. Mount into our container div.
      if (agreementRef.current) {
        signing.mount(agreementRef.current);
      }
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    void checkDocusignAuth();
  }, [checkDocusignAuth]);

  // Clean up the DocuSign mount when the modal closes.
  useEffect(() => {
    if (!open && agreementRef.current) {
      agreementRef.current.innerHTML = "";
      signingRef.current = null;
    }
  }, [open]);

  const closeModal = () => {
    setOpen(false);
    setStatus("idle");
    setError(null);
  };

  return (
    <>
      <div className="docusign-auth-row">
        <div
          className={`auth-pill ${
            authChecked && isAuthenticated ? "auth-pill-on" : "auth-pill-off"
          }`}
        >
          <span className="auth-dot" />
          {authChecked
            ? isAuthenticated
              ? "DocuSign Connected"
              : "DocuSign Not Connected"
            : "Checking DocuSign..."}
        </div>

        <button
          className="secondary-btn"
          onClick={() => void checkDocusignAuth()}
          disabled={checkingAuth}
        >
          {checkingAuth ? "Checking..." : "Check DocuSign Login"}
        </button>

        {!isAuthenticated && consentUrl && (
          <a
            className="secondary-btn"
            href={consentUrl}
            target="_blank"
            rel="noreferrer"
          >
            Connect DocuSign
          </a>
        )}
      </div>
      <p className="auth-message">{authMessage ?? " "}</p>

      <button
        className="primary-btn"
        onClick={() => setOpen(true)}
        disabled={!isAuthenticated || checkingAuth}
        title={isAuthenticated ? "Review and sign" : "Connect to DocuSign first"}
      >
        Review &amp; Sign Contract
      </button>

      {open && (
        <div className="overlay" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>Service Agreement</h2>
              <button
                className="close-btn"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* idle: show contract preview + sign CTA */}
              {status === "idle" && (
                <div className="contract-preview">
                  <p>
                    This Agreement is entered into between Acme Inc.
                    (&quot;Company&quot;) and you (&quot;Client&quot;). By
                    signing, you agree to the terms below. This remains legally
                    binding, even with a sense of humor.
                  </p>
                  <ol>
                    <li>
                      Scope of services as described in Exhibit A (the useful
                      part).
                    </li>
                    <li>
                      Payment terms: net 30 days, as foretold by accounting.
                    </li>
                    <li>
                      Term: 12 months from the effective date. Time is real.
                    </li>
                  </ol>
                  {!isAuthenticated && (
                    <p className="auth-hint">
                      Connect to DocuSign first. The sign button unlocks once
                      authentication is confirmed.
                    </p>
                  )}
                </div>
              )}

              {(status === "creating" || status === "loading") && (
                <div className="status-msg">
                  <div className="spinner" />
                  <p>
                    {status === "creating"
                      ? "Preparing your document. This is the thrilling part."
                      : "Loading signing experience. Please contain excitement."}
                  </p>
                </div>
              )}

              {/* The focused-view signing UI mounts into this div */}
              <div
                ref={agreementRef}
                className="agreement-container"
                style={{
                  display: status === "signing" ? "block" : "none",
                }}
              />

              {status === "complete" && (
                <div className="status-msg success">
                  <div className="checkmark">✓</div>
                  <h3>Signed successfully.</h3>
                  <p>Your agreement has been completed and recorded.</p>
                  <button className="primary-btn" onClick={closeModal}>
                    Done
                  </button>
                </div>
              )}

              {status === "declined" && (
                <div className="status-msg">
                  <p>You declined to sign the document. Noted.</p>
                  <button className="primary-btn" onClick={closeModal}>
                    Close
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="status-msg error">
                  <p>{error ?? "An error occurred. Bold choice."}</p>
                  <button
                    className="primary-btn"
                    onClick={startSigning}
                    disabled={!isAuthenticated || checkingAuth}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {status === "idle" && (
              <div className="modal-footer">
                <button className="secondary-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="primary-btn"
                  onClick={startSigning}
                  disabled={!isAuthenticated || checkingAuth}
                  title={
                    isAuthenticated ? "Start signing" : "Connect to DocuSign first"
                  }
                >
                  Agree &amp; Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
