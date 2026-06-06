export default function SigningComplete() {
  return (
    <main className="page">
      <div className="card">
        <h1>Signing complete</h1>
        <p>
          Thanks — your document has been signed. You can close this window.
        </p>
        <p style={{ color: "#666", fontSize: "0.85rem" }}>
          (With focused view, the app normally handles completion via the
          <code> sessionEnd </code> event without ever landing here. This page
          exists only as the API-required fallback returnUrl.)
        </p>
      </div>
    </main>
  );
}
