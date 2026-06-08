import type { ContentDisplayMethod, SigningApproach } from "./types";

interface ContractStepProps {
  signerName: string;
  signerEmail: string;
  approach: SigningApproach | null;
  displayMethod: ContentDisplayMethod | null;
  isAuthenticated: boolean;
  hasValidEmail: boolean;
  error: string | null;
  onSignerNameChange: (value: string) => void;
  onSignerEmailChange: (value: string) => void;
}

export function ContractStep({
  signerName,
  signerEmail,
  approach,
  displayMethod,
  isAuthenticated,
  hasValidEmail,
  error,
  onSignerNameChange,
  onSignerEmailChange,
}: ContractStepProps) {
  const contentSrc =
    displayMethod === "html" ? "/placeholder-contract.html" : "/api/contract-pdf";

  return (
    <div className="contract-preview">
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
      {approach === "custom_redirect" ||
      approach === "custom_embedded" ||
      approach === "clickwrap_custom" ? (
        <>
          <div className="pdf-review-frame">
            <iframe
              title={`Contract ${displayMethod === "html" ? "HTML" : "PDF"} preview`}
              src={contentSrc}
              className="pdf-review-iframe"
            />
          </div>
          <div className="custom-review-messages">
            <p>
              Please review this contract in full. By clicking the next action
              below, you confirm you reviewed the document and want to proceed.
            </p>
            {approach === "clickwrap_custom" && (
              <p>
                This path keeps the review experience in this app and records
                the acceptance through DocuSign Click.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <p>
            This Agreement is entered into between Acme Inc. (&quot;Company&quot;)
            and you (&quot;Client&quot;). By signing, you agree to the terms
            below. This remains legally binding, even with a sense of humor.
          </p>
          <ol>
            <li>Scope of services as described in Exhibit A (the useful part).</li>
            <li>Payment terms: net 30 days, as foretold by accounting.</li>
            <li>Term: 12 months from the effective date. Time is real.</li>
          </ol>
        </>
      )}
      {!isAuthenticated && (
        <p className="auth-hint">
          Connect to DocuSign first. The sign button unlocks once authentication
          is confirmed.
        </p>
      )}
      {!hasValidEmail && (
        <p className="auth-hint">Please enter a valid email to continue.</p>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
