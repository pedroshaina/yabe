import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Quicksand } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { TopBar } from "@/components/layout/TopBar";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import styles from "./layout.module.css";

// Downloaded at build time and served by this app: visitors' browsers never contact Google.
const display = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Y.A.B.E", template: "%s · Y.A.B.E" },
  description: "Yet Another Block Explorer",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Rendering the stored theme on the server means a reload never flashes the other theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className={styles.body}>
        <TopBar theme={theme} />
        <main className={styles.main}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
