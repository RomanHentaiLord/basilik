import type { Metadata, Viewport } from "next";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { siteHost } from "@/server/env";
import { fraktur, garamond } from "./fonts";
import "./globals.css";

const host = siteHost();

export const metadata: Metadata = {
  // Absolute links for the card images; on Vercel the production domain is used without it.
  metadataBase: host ? new URL(`https://${host}`) : undefined,
  title: "The Basilisk remembers",
  description:
    "A book that remembers every wallet. Scroll to turn its pages, then find your own: the Faithful are written in ink, traitors in red.",
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
