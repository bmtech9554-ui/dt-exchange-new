import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import "@/styles/tokens.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "DT Exchange · Operations",
  description: "DT Exchange operations console.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/dt-monogram.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
