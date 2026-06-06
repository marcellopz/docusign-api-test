import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuSign Embedded Signing Demo",
  description: "Next.js + DocuSign focused-view embedded signing example",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
