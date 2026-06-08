import type { ContentDisplayMethod } from "./types";

interface DisplayMethodStepProps {
  displayMethod: ContentDisplayMethod | null;
  error: string | null;
  onSelectDisplayMethod: (method: ContentDisplayMethod) => void;
}

export function DisplayMethodStep({
  displayMethod,
  error,
  onSelectDisplayMethod,
}: DisplayMethodStepProps) {
  return (
    <div className="approach-step">
      <h3>Choose Content Display Method</h3>
      <p>Select how the agreement should be shown before choosing signing mode.</p>
      <div className="approach-options">
        <button
          className={`approach-card ${
            displayMethod === "pdf" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectDisplayMethod("pdf")}
          type="button"
        >
          <strong>PDF</strong>
          <span>Display the agreement as a PDF document.</span>
        </button>
        <button
          className={`approach-card ${
            displayMethod === "html" ? "approach-card-active" : ""
          }`}
          onClick={() => onSelectDisplayMethod("html")}
          type="button"
        >
          <strong>HTML</strong>
          <span>Display the agreement as an HTML document.</span>
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
