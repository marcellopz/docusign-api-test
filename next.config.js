/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The docusign-esign SDK uses Node-style bare-relative requires that the
  // webpack bundler can't resolve. Keep it as a runtime dependency on the
  // server instead of bundling it.
  serverExternalPackages: ["docusign-esign"],
};

module.exports = nextConfig;
