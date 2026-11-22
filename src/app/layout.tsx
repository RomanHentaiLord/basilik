import type { Metadata, Viewport } from "next";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { fraktur, garamond } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
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
