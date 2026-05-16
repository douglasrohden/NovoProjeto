import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Processing Platform",
  description: "Upload, process and enrich documents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
