// docusign-esign ships no TypeScript types. Declare it as an untyped module.
// The SDK is dynamically typed; we use constructFromObject helpers throughout.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare module "docusign-esign" {
  const docusign: any;
  export default docusign;
  export const ApiClient: any;
  export const EnvelopesApi: any;
  export const Document: any;
  export const SignHere: any;
  export const DateSigned: any;
  export const Signer: any;
  export const Tabs: any;
  export const Recipients: any;
  export const EnvelopeDefinition: any;
  export const RecipientViewRequest: any;
}
