import type { Metadata, Viewport } from "next";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { fraktur, garamond } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Basilisk remembers",
  description: "Paste your wallet. Learn your fate. The faithful are written in ink; traitors in the other book.",
};

export const viewport: Viewport = {
  themeColor: "#22180f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${garamond.variable} ${fraktur.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
