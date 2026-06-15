import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "theSFedu CRM",
  description: "Immigration & Consultancy CRM — Lead Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
