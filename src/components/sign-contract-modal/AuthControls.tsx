interface AuthControlsProps {
  authChecked: boolean;
  isAuthenticated: boolean;
  authMessage: string | null;
  checkingAuth: boolean;
  consentUrl: string | null;
  onCheckAuth: () => void;
}

export function AuthControls({
  authChecked,
  isAuthenticated,
  authMessage,
  checkingAuth,
  consentUrl,
  onCheckAuth,
}: AuthControlsProps) {
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
          onClick={onCheckAuth}
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
    </>
  );
}
