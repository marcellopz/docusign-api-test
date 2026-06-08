import type { ContentDisplayMethod, SigningApproach } from "./types";

interface ApproachStepProps {
  approach: SigningApproach | null;
  displayMethod: ContentDisplayMethod | null;
  error: string | null;
  onSelectApproach: (approach: SigningApproach) => void;
}

export function ApproachStep({
  approach,
  displayMethod,
  error,
  onSelectApproach,
}: ApproachStepProps) {
  const showCustomOptions = displayMethod !== "html";

  return (
    <div className="approach-step">
      <h3>Choose How You Want to Complete</h3>
      <p>Pick your preferred approach before reviewing the contract.</p>
      <div className="approach-options">
        <button
          className={`approach-card ${
            approach === "agree" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectApproach("agree")}
          type="button"
        >
          <strong>Agree</strong>
          <span>Confirm acceptance and finish quickly.</span>
        </button>
        <button
          className={`approach-card ${
            approach === "sign" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectApproach("sign")}
          type="button"
        >
          <strong>Sign</strong>
          <span>Fill required signature and initial fields.</span>
        </button>
        {showCustomOptions && (
          <>
            <button
              className={`approach-card ${
                approach === "custom_redirect" ? "approach-card-active" : ""
              }`}
              onClick={() => onSelectApproach("custom_redirect")}
              type="button"
            >
              <strong>Custom Review + Redirect to DocuSign</strong>
              <span>
                Review the PDF here with your own messages, then continue
                without the embedded DocuSign iframe.
              </span>
            </button>
            <button
              className={`approach-card ${
                approach === "custom_embedded" ? "approach-card-active" : ""
              }`}
              onClick={() => onSelectApproach("custom_embedded")}
              type="button"
            >
              <strong>Custom Review + In-app Signing</strong>
              <span>
                Review the PDF with your own messages, then continue signing
                inside this app (no redirect).
              </span>
            </button>
          </>
        )}
        <button
          className={`approach-card ${
            approach === "clickwrap_embedded" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectApproach("clickwrap_embedded")}
          type="button"
        >
          <strong>Clickwrap Widget</strong>
          <span>
            Show DocuSign Click&apos;s embedded acceptance widget and finish
            from its callback.
          </span>
        </button>
        <button
          className={`approach-card ${
            approach === "clickwrap_custom" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectApproach("clickwrap_custom")}
          type="button"
        >
          <strong>Custom UI + Clickwrap</strong>
          <span>
            Review the contract here, then create a DocuSign Click agreement for
            the accept action.
          </span>
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
