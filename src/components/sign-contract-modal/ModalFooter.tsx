import type { ModalStep, SigningApproach } from "./types";

interface ModalFooterProps {
  modalStep: ModalStep;
  approach: SigningApproach | null;
  canSign: boolean;
  isAuthenticated: boolean;
  onCancel: () => void;
  onContinueStep: () => void;
  onSubmit: () => void;
}

export function ModalFooter({
  modalStep,
  approach,
  canSign,
  isAuthenticated,
  onCancel,
  onContinueStep,
  onSubmit,
}: ModalFooterProps) {
  return (
    <div className="modal-footer">
      <button className="secondary-btn" onClick={onCancel}>
        Cancel
      </button>
      {modalStep !== "contract" ? (
        <button className="primary-btn" onClick={onContinueStep}>
          Continue
        </button>
      ) : (
        <button
          className="primary-btn"
          onClick={onSubmit}
          disabled={!canSign}
          title={
            isAuthenticated
              ? "Enter name/email to continue"
              : "Connect to DocuSign first"
          }
        >
          {approach === "agree"
            ? "Agree & Confirm"
            : approach === "custom_redirect"
              ? "Agree & Continue"
              : approach === "custom_embedded"
                ? "Agree & Sign In App"
              : "Continue to Signature Fields"}
        </button>
      )}
    </div>
  );
}
