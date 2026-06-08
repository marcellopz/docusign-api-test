interface LoadingViewProps {
  status: "creating" | "loading";
}

export function LoadingView({ status }: LoadingViewProps) {
  return (
    <div className="status-msg">
      <div className="spinner" />
      <p>
        {status === "creating"
          ? "Preparing your document. This is the thrilling part."
          : "Loading signing experience. Please contain excitement."}
      </p>
    </div>
  );
}

interface CompleteViewProps {
  onClose: () => void;
}

export function CompleteView({ onClose }: CompleteViewProps) {
  return (
    <div className="status-msg success">
      <div className="checkmark">✓</div>
      <h3>Signed successfully.</h3>
      <p>Your agreement has been completed and recorded.</p>
      <button className="primary-btn" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

interface DeclinedViewProps {
  onClose: () => void;
}

export function DeclinedView({ onClose }: DeclinedViewProps) {
  return (
    <div className="status-msg">
      <p>You declined to sign the document. Noted.</p>
      <button className="primary-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

interface ErrorViewProps {
  error: string | null;
  canSign: boolean;
  onRetry: () => void;
}

export function ErrorView({ error, canSign, onRetry }: ErrorViewProps) {
  return (
    <div className="status-msg error">
      <p>{error ?? "An error occurred. Bold choice."}</p>
      <button className="primary-btn" onClick={onRetry} disabled={!canSign}>
        Try again
      </button>
    </div>
  );
}
