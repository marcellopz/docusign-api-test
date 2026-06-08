"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DocuSignSessionEndEvent,
  DocuSignSigning,
} from "@/lib/docusign-js";
import { AuthControls } from "@/components/sign-contract-modal/AuthControls";
import { DisplayMethodStep } from "@/components/sign-contract-modal/DisplayMethodStep";
import { ApproachStep } from "@/components/sign-contract-modal/ApproachStep";
import { ContractStep } from "@/components/sign-contract-modal/ContractStep";
import { ModalFooter } from "@/components/sign-contract-modal/ModalFooter";
import {
  CompleteView,
  DeclinedView,
  ErrorView,
  LoadingView,
} from "@/components/sign-contract-modal/SigningStatusViews";
import type {
  ContentDisplayMethod,
  ModalStep,
  SigningApproach,
  Status,
} from "@/components/sign-contract-modal/types";

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
  const [modalStep, setModalStep] = useState<ModalStep>("display");
  const [displayMethod, setDisplayMethod] =
    useState<ContentDisplayMethod | null>(null);
  const [approach, setApproach] = useState<SigningApproach | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("Test Signer");
  const [signerEmail, setSignerEmail] = useState("test.signer@example.com");
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const agreementRef = useRef<HTMLDivElement>(null);
  const signingRef = useRef<DocuSignSigning | null>(null);
  const trimmedName = signerName.trim();
  const trimmedEmail = signerEmail.trim();
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSign =
    isAuthenticated &&
    !checkingAuth &&
    trimmedName.length > 0 &&
    hasValidEmail;

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
    if (!displayMethod) {
      setStatus("idle");
      setError("Please choose a content display method before continuing.");
      return;
    }
    if (!approach) {
      setStatus("idle");
      setError("Please choose an approach before continuing.");
      return;
    }
    if (!trimmedName || !hasValidEmail) {
      setStatus("idle");
      setError("Please enter a valid name and email before signing.");
      return;
    }

    setStatus("creating");
    setError(null);
    try {
      // 1. Ask our backend to create the envelope and a focused-view signing URL.
      const res = await fetch("/api/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          name: trimmedName,
          approach,
          displayMethod,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }
      const { signingUrl } = (await res.json()) as { signingUrl: string };

      if (approach === "custom_redirect") {
        window.location.assign(signingUrl);
        return;
      }

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
  }, [approach, displayMethod, hasValidEmail, trimmedEmail, trimmedName]);

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
    setModalStep("display");
    setDisplayMethod(null);
    setApproach(null);
    setError(null);
  };

  return (
    <>
      <AuthControls
        authChecked={authChecked}
        isAuthenticated={isAuthenticated}
        authMessage={authMessage}
        checkingAuth={checkingAuth}
        consentUrl={consentUrl}
        onCheckAuth={() => void checkDocusignAuth()}
      />

      <button
        className="primary-btn"
        onClick={() => {
          setOpen(true);
          setStatus("idle");
          setModalStep("display");
          setDisplayMethod(null);
          setApproach(null);
          setError(null);
        }}
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
              {status === "idle" && modalStep === "display" && (
                <DisplayMethodStep
                  displayMethod={displayMethod}
                  error={error}
                  onSelectDisplayMethod={(method) => {
                    setDisplayMethod(method);
                    if (
                      method === "html" &&
                      (approach === "custom_redirect" ||
                        approach === "custom_embedded")
                    ) {
                      setApproach(null);
                    }
                  }}
                />
              )}

              {status === "idle" && modalStep === "approach" && (
                <ApproachStep
                  approach={approach}
                  displayMethod={displayMethod}
                  error={error}
                  onSelectApproach={setApproach}
                />
              )}

              {status === "idle" && modalStep === "contract" && (
                <ContractStep
                  signerName={signerName}
                  signerEmail={signerEmail}
                  approach={approach}
                  displayMethod={displayMethod}
                  isAuthenticated={isAuthenticated}
                  hasValidEmail={hasValidEmail}
                  error={error}
                  onSignerNameChange={setSignerName}
                  onSignerEmailChange={setSignerEmail}
                />
              )}

              {(status === "creating" || status === "loading") && (
                <LoadingView status={status} />
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
                <CompleteView onClose={closeModal} />
              )}

              {status === "declined" && <DeclinedView onClose={closeModal} />}

              {status === "error" && (
                <ErrorView error={error} canSign={canSign} onRetry={startSigning} />
              )}
            </div>

            {status === "idle" && (
              <ModalFooter
                modalStep={modalStep}
                approach={approach}
                canSign={canSign}
                isAuthenticated={isAuthenticated}
                onCancel={closeModal}
                onContinueStep={() => {
                  if (modalStep === "display") {
                    if (!displayMethod) {
                      setError("Please choose PDF or HTML.");
                      return;
                    }
                    setError(null);
                    setModalStep("approach");
                    return;
                  }

                  if (!approach) {
                    setError(
                      "Please choose Agree, Sign, or one Custom Review option."
                    );
                    return;
                  }
                  setError(null);
                  if (approach === "custom_redirect" || approach === "custom_embedded") {
                    setModalStep("contract");
                  } else {
                    void startSigning();
                  }
                }}
                onSubmit={startSigning}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
