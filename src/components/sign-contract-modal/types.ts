export type Status =
  | "idle"
  | "creating"
  | "loading"
  | "signing"
  | "complete"
  | "declined"
  | "error";

export type SigningApproach =
  | "agree"
  | "sign"
  | "custom_redirect"
  | "custom_embedded";
export type ContentDisplayMethod = "pdf" | "html";
export type ModalStep = "display" | "approach" | "contract";
