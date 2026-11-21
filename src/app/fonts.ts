import localFont from "next/font/local";

/** Book text: EB Garamond, variable weight, with real italics. Self-hosted from @fontsource. */
export const garamond = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2",
      weight: "400 800",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2",
      weight: "400 800",
      style: "italic",
    },
  ],
  variable: "--font-garamond",
  display: "swap",
});

/** Headings and the illuminated initial: UnifrakturMaguntia blackletter. */
export const fraktur = localFont({
  src: "../../node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-fraktur",
  display: "swap",
});
