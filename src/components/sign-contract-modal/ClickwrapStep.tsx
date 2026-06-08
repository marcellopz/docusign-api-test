"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const CLICK_ENVIRONMENT =
  process.env.NEXT_PUBLIC_DOCUSIGN_CLICK_ENVIRONMENT ??
  "https://demo.docusign.net";
const CLICKWRAP_ID = process.env.NEXT_PUBLIC_DOCUSIGN_CLICKWRAP_ID ?? "";
const ACCOUNT_ID = process.env.NEXT_PUBLIC_DOCUSIGN_ACCOUNT_ID;

function loadDocuSignClickBundle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.docuSignClick) return resolve();

    const src = `${CLICK_ENVIRONMENT.replace(
      /\/+$/,
      ""
    )}/clickapi/sdk/latest/docusign-click.js`;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load DocuSign Click"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load DocuSign Click"));
    document.head.appendChild(script);
  });
}

interface ClickwrapStepProps {
  signerName: string;
  signerEmail: string;
  hasValidEmail: boolean;
  onSignerNameChange: (value: string) => void;
  onSignerEmailChange: (value: string) => void;
  onComplete: () => void;
  onDeclined: () => void;
  onError: (message: string) => void;
}

export function ClickwrapStep({
  signerName,
  signerEmail,
  hasValidEmail,
  onSignerNameChange,
  onSignerEmailChange,
  onComplete,
  onDeclined,
  onError,
}: ClickwrapStepProps) {
  const containerId = "docusign-clickwrap-container";
  const renderedForClientRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const trimmedName = signerName.trim();
  const trimmedEmail = signerEmail.trim();
  const canRender = trimmedName.length > 0 && hasValidEmail;
  const clientUserId = useMemo(
    () => `clickwrap:${trimmedEmail.toLowerCase()}`,
    [trimmedEmail]
  );

  useEffect(() => {
    if (!canRender) return;
    if (!CLICKWRAP_ID || CLICKWRAP_ID === "replace-with-clickwrap-id") {
      onError("Missing NEXT_PUBLIC_DOCUSIGN_CLICKWRAP_ID environment variable.");
      return;
    }
    if (!ACCOUNT_ID) {
      onError("Missing NEXT_PUBLIC_DOCUSIGN_ACCOUNT_ID environment variable.");
      return;
    }
    if (renderedForClientRef.current === clientUserId) return;

    let cancelled = false;
    setLoading(true);
    void loadDocuSignClickBundle()
      .then(() => {
        if (cancelled) return;
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = "";
        if (!window.docuSignClick) {
          throw new Error("DocuSign Click unavailable");
        }
        renderedForClientRef.current = clientUserId;
        window.docuSignClick.Clickwrap.render(
          {
            environment: CLICK_ENVIRONMENT,
            accountId: ACCOUNT_ID,
            clickwrapId: CLICKWRAP_ID,
            clientUserId,
            documentData: {
              fullName: trimmedName,
              email: trimmedEmail,
              date: new Date().toISOString(),
            },
            onAgreed: () => onComplete(),
            onDeclined: () => onDeclined(),
            onError: (err) =>
              onError(err instanceof Error ? err.message : "Clickwrap failed."),
          },
          `#${containerId}`
        );
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : "Clickwrap failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    canRender,
    clientUserId,
    hasValidEmail,
    onComplete,
    onDeclined,
    onError,
    trimmedEmail,
    trimmedName,
  ]);

  return (
    <div className="clickwrap-step">
      <div className="signer-fields">
        <label className="form-field">
          <span>Name</span>
          <input
            className="modal-input"
            type="text"
            value={signerName}
            onChange={(e) => onSignerNameChange(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input
            className="modal-input"
            type="email"
            value={signerEmail}
            onChange={(e) => onSignerEmailChange(e.target.value)}
            placeholder="jane@example.com"
            autoComplete="email"
          />
        </label>
      </div>
      <p>
        Complete acceptance through the embedded DocuSign Clickwrap widget below.
      </p>
      {!hasValidEmail && (
        <p className="auth-hint">Please enter a valid email to load Clickwrap.</p>
      )}
      {loading && <p className="auth-hint">Loading DocuSign Clickwrap...</p>}
      <div id={containerId} className="clickwrap-container" />
    </div>
  );
}
