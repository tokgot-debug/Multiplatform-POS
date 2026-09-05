import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/ui/styles.css";

export const metadata: Metadata = {
  title: "KPOS Pro — KRA eTIMS Multi-Platform POS",
  description: "Vanbransa ProPos — offline-first point of sale for bar and restaurant service.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="dark-mode">
        <div id="app-container">{children}</div>
      </body>
    </html>
  );
}
