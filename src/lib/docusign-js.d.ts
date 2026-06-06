// Minimal typings for the DocuSign JS bundle (window.DocuSign).
// The bundle is loaded at runtime from js-d.docusign.com / js.docusign.com.

export interface DocuSignSigningStyle {
  branding?: {
    primaryButton?: {
      backgroundColor?: string;
      color?: string;
    };
  };
  signingNavigationButton?: {
    finishText?: string;
    position?: "bottom-left" | "bottom-center" | "bottom-right";
  };
}

export interface DocuSignSigningConfig {
  url: string;
  displayFormat?: "focused" | "default";
  style?: DocuSignSigningStyle;
}

export interface DocuSignSessionEndEvent {
  // e.g. "signing_complete" | "cancel" | "decline" | "exception"
  // | "fax_pending" | "session_timeout" | "ttl_expired" | "viewing_complete"
  sessionEndType?: string;
  type?: string;
  returnUrl?: string;
  [key: string]: unknown;
}

export interface DocuSignSigning {
  on(
    event: "ready",
    handler: (event: unknown) => void
  ): void;
  on(
    event: "sessionEnd",
    handler: (event: DocuSignSessionEndEvent) => void
  ): void;
  mount(selector: string | HTMLElement): void;
}

export interface DocuSignInstance {
  signing(config: DocuSignSigningConfig): DocuSignSigning;
}

export interface DocuSignGlobal {
  loadDocuSign(integrationKey: string): Promise<DocuSignInstance>;
}

declare global {
  interface Window {
    DocuSign?: DocuSignGlobal;
  }
}

export {};
