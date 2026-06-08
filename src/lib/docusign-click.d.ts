interface DocuSignClickAgreement {
  agreementId?: string;
  agreedOn?: string;
  declinedOn?: string;
  status?: string;
}

interface DocuSignClickRenderConfig {
  environment: string;
  accountId: string;
  clickwrapId: string;
  clientUserId: string;
  documentData?: Record<string, string>;
  onMustAgree?: (agreement: DocuSignClickAgreement) => void;
  onAgreed?: (agreement: DocuSignClickAgreement) => void;
  onDeclined?: (agreement: DocuSignClickAgreement) => void;
  onError?: (error: unknown) => void;
}

interface Window {
  docuSignClick?: {
    Clickwrap: {
      render: (config: DocuSignClickRenderConfig, selector: string) => void;
    };
  };
}
